#include "mf_encoder.h"
#include <mfapi.h>
#include <mferror.h>
#include <mfidl.h>
#include <algorithm>
#include <cstdint>
#include <iostream>
#include <cstring>

// Profile and rate control GUIDs from Windows SDK (codecapi.h / mfapi.h)
// Defined manually to avoid header dependency issues
#ifndef eAVEncH264VProfile_High
static constexpr DWORD eAVEncH264VProfile_High = 100;
#endif
#ifndef eAVEncH264VProfile_High444
static constexpr DWORD eAVEncH264VProfile_High444 = 244;
#endif

// CodecAPI GUIDs for rate control (from codecapi.h)
// {B8D203AB-AFC5-4BCF-8D75-4973B15E3E7F}
static const GUID API_ECenablePictureTypeDecision =
    {0xB8D203AB, 0xAFC5, 0x4BCF, {0x8D, 0x75, 0x49, 0x73, 0xB1, 0x5E, 0x3E, 0x7F}};

// MF_MT_MPEG2_BITRATE_MODE: CodecAPI attribute for VBR mode
// {80A2D2E9-C3B3-4b7a-85F0-5D2FE72D850F}
static const GUID MF_MT_MPEG2_BITRATE_MODE_CUSTOM =
    {0x80A2D2E9, 0xC3B3, 0x4b7a, {0x85, 0xF0, 0x5D, 0x2F, 0xE7, 0x2D, 0x85, 0x0F}};

#pragma comment(lib, "mfplat.lib")
#pragma comment(lib, "mfreadwrite.lib")
#pragma comment(lib, "mf.lib")
#pragma comment(lib, "mfuuid.lib")

static int clampByte(int v) {
    return v < 0 ? 0 : (v > 255 ? 255 : v);
}

static HRESULT setBt709LimitedVideoAttributes(IMFMediaType* mediaType) {
    HRESULT result = mediaType->SetUINT32(MF_MT_VIDEO_PRIMARIES, MFVideoPrimaries_BT709);
    if (FAILED(result)) return result;
    result = mediaType->SetUINT32(MF_MT_TRANSFER_FUNCTION, MFVideoTransFunc_709);
    if (FAILED(result)) return result;
    result = mediaType->SetUINT32(MF_MT_YUV_MATRIX, MFVideoTransferMatrix_BT709);
    if (FAILED(result)) return result;
    return mediaType->SetUINT32(MF_MT_VIDEO_NOMINAL_RANGE, MFNominalRange_16_235);
}

static QualityPreset parseQualityPreset(int value) {
    if (value == 1) return QualityPreset::Low;
    if (value == 2) return QualityPreset::Medium;
    if (value == 3) return QualityPreset::High;
    if (value == 4) return QualityPreset::Ultra;
    if (value == 5) return QualityPreset::PixelPerfect;
    return QualityPreset::Medium;
}

static double getQualityBitrateMultiplier(QualityPreset q) {
    switch (q) {
        case QualityPreset::Low:          return 0.75;
        case QualityPreset::Medium:       return 1.0;
        case QualityPreset::High:         return 1.5;
        case QualityPreset::Ultra:        return 2.0;
        case QualityPreset::PixelPerfect: return 2.5;
    }
    return 1.0;
}

static UINT32 calculateScreenRecordingBitrate(int width, int height, int fps, QualityPreset quality) {
    constexpr uint64_t kEightKPixels = 7680ULL * 4320ULL;
    constexpr uint64_t kFourKPixels = 3840ULL * 2160ULL;
    constexpr uint64_t kQhdPixels = 2560ULL * 1440ULL;
    constexpr UINT32 kBitrate8K = 80000000;
    constexpr UINT32 kBitrate4K = 45000000;
    constexpr UINT32 kBitrateQhd = 28000000;
    constexpr UINT32 kBitrateBase = 18000000;
    constexpr double kHighFrameRateBoost = 1.35;

    const uint64_t pixels =
        static_cast<uint64_t>((std::max)(width, 1)) *
        static_cast<uint64_t>((std::max)(height, 1));
    const UINT32 baseBitrate =
        pixels >= kEightKPixels ? kBitrate8K :
        pixels >= kFourKPixels ? kBitrate4K :
        pixels >= kQhdPixels ? kBitrateQhd :
        kBitrateBase;
    const double boost = fps >= 60 ? kHighFrameRateBoost : 1.0;
    const double qualityMul = getQualityBitrateMultiplier(quality);
    return static_cast<UINT32>(static_cast<double>(baseBitrate) * boost * qualityMul + 0.5);
}

MFEncoder::MFEncoder() {}

MFEncoder::~MFEncoder() {
    finalize();
}

bool MFEncoder::initialize(const std::wstring& outputPath, int width, int height, int fps,
                           ID3D11Device* device, ID3D11DeviceContext* context, int qualityPreset) {
    std::lock_guard<std::mutex> lock(mutex_);

    if (initialized_) return false;

    if (fps <= 0) {
        std::cerr << "ERROR: Encoder fps must be positive, got " << fps << std::endl;
        return false;
    }

    if (width % 2 != 0 || height % 2 != 0) {
        std::cerr << "ERROR: Encoder dimensions must be even, got " << width << "x" << height << std::endl;
        return false;
    }

    width_ = width;
    height_ = height;
    fps_ = fps;
    device_ = device;
    context_ = context;
    quality_ = parseQualityPreset(qualityPreset);

    HRESULT hr = MFStartup(MF_VERSION);
    if (FAILED(hr)) {
        std::cerr << "ERROR: MFStartup failed: 0x" << std::hex << hr << std::endl;
        return false;
    }

    // --- Output media type ---
    ComPtr<IMFMediaType> outputType;
    hr = MFCreateMediaType(&outputType);
    if (FAILED(hr)) return false;

    outputType->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);

    // Use HEVC for high quality and 8K, H.264 for lower
    const bool preferHevc = (quality_ == QualityPreset::Ultra ||
                             quality_ == QualityPreset::PixelPerfect ||
                             width_ > 3840 || height_ > 2160);
    if (preferHevc) {
        outputType->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_HEVC);
        if (quality_ == QualityPreset::PixelPerfect) {
            // HEVC Main 4:4:4 profile for lossless-like quality
            outputType->SetUINT32(MF_MT_MPEG2_PROFILE, 4);  // Main 4:4:4
            std::cerr << "Encoder: HEVC Main 4:4:4 (Pixel Perfect)" << std::endl;
        }
    } else {
        outputType->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_H264);
        if (quality_ == QualityPreset::High) {
            outputType->SetUINT32(MF_MT_MPEG2_PROFILE, eAVEncH264VProfile_High);
        } else if (quality_ == QualityPreset::PixelPerfect) {
            outputType->SetUINT32(MF_MT_MPEG2_PROFILE, eAVEncH264VProfile_High444);
        }
    }

    // Quality-based encoding: bitrate is scaled by quality preset multiplier
    const UINT32 avgBitrate = calculateScreenRecordingBitrate(width_, height_, fps_, quality_);
    outputType->SetUINT32(MF_MT_AVG_BITRATE, avgBitrate);

    MFSetAttributeSize(outputType.Get(), MF_MT_FRAME_SIZE, width_, height_);
    MFSetAttributeRatio(outputType.Get(), MF_MT_FRAME_RATE, fps_, 1);
    MFSetAttributeRatio(outputType.Get(), MF_MT_PIXEL_ASPECT_RATIO, 1, 1);
    outputType->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
    hr = setBt709LimitedVideoAttributes(outputType.Get());
    if (FAILED(hr)) {
        std::cerr << "WARN: setBt709LimitedVideoAttributes failed: 0x" << std::hex << hr << std::endl;
    }

    std::cerr << "Encoder: " << (preferHevc ? "HEVC" : "H.264")
              << " quality=" << static_cast<int>(quality_)
              << " bitrate=" << avgBitrate << " bps"
              << " VBR mode"
              << " for " << width_ << "x" << height_ << "@" << fps_ << "fps" << std::endl;

    // --- Input media type ---
    // For Pixel Perfect: use RGB32 (BGRA) to preserve full color depth
    // For others: use NV12 (standard)
    ComPtr<IMFMediaType> inputType;
    hr = MFCreateMediaType(&inputType);
    if (FAILED(hr)) return false;

    inputType->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
    MFSetAttributeSize(inputType.Get(), MF_MT_FRAME_SIZE, width_, height_);
    MFSetAttributeRatio(inputType.Get(), MF_MT_FRAME_RATE, fps_, 1);
    MFSetAttributeRatio(inputType.Get(), MF_MT_PIXEL_ASPECT_RATIO, 1, 1);
    inputType->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);

    if (quality_ == QualityPreset::PixelPerfect) {
        // RGB32 input: no chroma subsampling, full color depth preserved
        inputType->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_RGB32);
        useRgbInput_ = true;
        std::cerr << "Input: RGB32 (full color, no chroma subsampling)" << std::endl;
    } else {
        // NV12 input: standard for H.264/HEVC encoding
        inputType->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_NV12);
        useRgbInput_ = false;
        std::cerr << "Input: NV12" << std::endl;
    }

    // --- Create SinkWriter ---
    ComPtr<IMFAttributes> writerAttrs;
    hr = MFCreateAttributes(&writerAttrs, 4);
    if (FAILED(hr)) return false;

    // Enable async mode for better performance
    writerAttrs->SetUINT32(MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, TRUE);

    // For Ultra/Pixel Perfect: set SINK_WRITER_DISABLE_THROTTLING
    if (quality_ == QualityPreset::Ultra || quality_ == QualityPreset::PixelPerfect) {
        writerAttrs->SetUINT32(MF_SINK_WRITER_DISABLE_THROTTLING, TRUE);
    }

    hr = MFCreateSinkWriterFromURL(outputPath.c_str(), nullptr, writerAttrs.Get(), &sinkWriter_);
    if (FAILED(hr)) {
        std::cerr << "ERROR: MFCreateSinkWriterFromURL failed: 0x" << std::hex << hr << std::endl;
        return false;
    }

    hr = sinkWriter_->AddStream(outputType.Get(), &streamIndex_);
    if (FAILED(hr)) {
        std::cerr << "ERROR: AddStream failed: 0x" << std::hex << hr << std::endl;
        return false;
    }

    hr = sinkWriter_->SetInputMediaType(streamIndex_, inputType.Get(), nullptr);
    if (FAILED(hr)) {
        std::cerr << "ERROR: SetInputMediaType failed: 0x" << std::hex << hr << std::endl;
        return false;
    }

    hr = sinkWriter_->BeginWriting();
    if (FAILED(hr)) {
        std::cerr << "ERROR: BeginWriting failed: 0x" << std::hex << hr << std::endl;
        return false;
    }

    // Pre-allocate staging texture (BGRA - always, since WGC outputs BGRA)
    D3D11_TEXTURE2D_DESC stagingDesc = {};
    stagingDesc.Width = width_;
    stagingDesc.Height = height_;
    stagingDesc.MipLevels = 1;
    stagingDesc.ArraySize = 1;
    stagingDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    stagingDesc.SampleDesc.Count = 1;
    stagingDesc.Usage = D3D11_USAGE_STAGING;
    stagingDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;

    hr = device_->CreateTexture2D(&stagingDesc, nullptr, &stagingTexture_);
    if (FAILED(hr)) {
        std::cerr << "ERROR: Failed to create staging texture: 0x" << std::hex << hr << std::endl;
        return false;
    }

    // Resize composite texture for dynamic frame size changes
    D3D11_TEXTURE2D_DESC compositeDesc = {};
    compositeDesc.Width = width_;
    compositeDesc.Height = height_;
    compositeDesc.MipLevels = 1;
    compositeDesc.ArraySize = 1;
    compositeDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    compositeDesc.SampleDesc.Count = 1;
    compositeDesc.Usage = D3D11_USAGE_DEFAULT;
    compositeDesc.BindFlags = D3D11_BIND_RENDER_TARGET;

    hr = device_->CreateTexture2D(&compositeDesc, nullptr, &resizeCompositeTexture_);
    if (FAILED(hr)) {
        std::cerr << "ERROR: Failed to create resize composite texture: 0x" << std::hex << hr << std::endl;
        return false;
    }

    hr = device_->CreateRenderTargetView(resizeCompositeTexture_.Get(), nullptr, &resizeCompositeView_);
    if (FAILED(hr)) {
        std::cerr << "ERROR: Failed to create resize composite view: 0x" << std::hex << hr << std::endl;
        return false;
    }

    // Pre-allocate frame buffer
    if (useRgbInput_) {
        // RGB32: 4 bytes per pixel
        rgbBuffer_.resize(static_cast<size_t>(width_) * height_ * 4);
    } else {
        // NV12: Y + UV planes
        const int ySize = width_ * height_;
        const int uvSize = (width_ / 2) * (height_ / 2) * 2;
        nv12Buffer_.resize(ySize + uvSize);
    }
    lastFrameBuffer_.clear();
    firstSampleTimeHns_ = -1;
    lastSampleTimeHns_ = -1;

    initialized_ = true;
    return true;
}

bool MFEncoder::writeFrame(ID3D11Texture2D* texture, int64_t timestampHns) {
    std::lock_guard<std::mutex> lock(mutex_);

    if (!initialized_ || !sinkWriter_) return false;

    D3D11_TEXTURE2D_DESC sourceDesc = {};
    texture->GetDesc(&sourceDesc);

    if (sourceDesc.Width == static_cast<UINT>(width_) &&
        sourceDesc.Height == static_cast<UINT>(height_)) {
        context_->CopyResource(stagingTexture_.Get(), texture);
    } else {
        if (!resizeCompositeTexture_ || !resizeCompositeView_) return false;

        const FLOAT clearColor[4] = {0.0f, 0.0f, 0.0f, 1.0f};
        context_->ClearRenderTargetView(resizeCompositeView_.Get(), clearColor);

        D3D11_BOX sourceBox = {};
        sourceBox.left = 0;
        sourceBox.top = 0;
        sourceBox.front = 0;
        sourceBox.right = (std::min)(sourceDesc.Width, static_cast<UINT>(width_));
        sourceBox.bottom = (std::min)(sourceDesc.Height, static_cast<UINT>(height_));
        sourceBox.back = 1;

        if (sourceBox.right == 0 || sourceBox.bottom == 0) return false;

        context_->CopySubresourceRegion(
            resizeCompositeTexture_.Get(), 0, 0, 0, 0,
            texture, 0, &sourceBox);
        context_->CopyResource(stagingTexture_.Get(), resizeCompositeTexture_.Get());
    }

    D3D11_MAPPED_SUBRESOURCE mapped;
    HRESULT hr = context_->Map(stagingTexture_.Get(), 0, D3D11_MAP_READ, 0, &mapped);
    if (FAILED(hr)) return false;

    const uint8_t* bgra = static_cast<const uint8_t*>(mapped.pData);
    const int bgraPitch = static_cast<int>(mapped.RowPitch);

    // WGC may stop delivering frames while the scene is static; keep the MP4
    // timeline continuous by repeating the previous frame before writing a new one.
    int64_t normalizedTimestampHns = 0;
    normalizeWriteTimestampHnsLocked(timestampHns, normalizedTimestampHns);

    if (!lastFrameBuffer_.empty() && !extendLastFrameToLocked(normalizedTimestampHns)) {
        context_->Unmap(stagingTexture_.Get(), 0);
        return false;
    }

    bool wroteSample = false;
    if (useRgbInput_) {
        wroteSample = writeRgb32SampleLocked(bgra, bgraPitch, normalizedTimestampHns);
    } else {
        convertBgraToNv12(bgra, bgraPitch);
        wroteSample = writeNv12SampleLocked(nv12Buffer_, normalizedTimestampHns);
    }

    if (wroteSample) {
        if (useRgbInput_) {
            // Store RGB buffer for frame extension
            rgbFrameBuffer_.assign(bgra, bgra + static_cast<size_t>(width_) * height_ * 4);
            lastFrameBuffer_.clear();
        } else {
            lastFrameBuffer_ = nv12Buffer_;
        }
        lastSampleTimeHns_ = normalizedTimestampHns;
    }

    context_->Unmap(stagingTexture_.Get(), 0);
    return wroteSample;
}

void MFEncoder::convertBgraToNv12(const uint8_t* bgra, int bgraPitch) {
    const int w = width_;
    const int h = height_;
    const int ySize = w * h;
    uint8_t* yPlane = nv12Buffer_.data();
    uint8_t* uvPlane = yPlane + ySize;

    // Y plane (multithreaded with OpenMP across scanlines)
    #pragma omp parallel for schedule(static)
    for (int y = 0; y < h; y++) {
        const uint8_t* srcRow = bgra + y * bgraPitch;
        uint8_t* dstY = yPlane + y * w;
        for (int x = 0; x < w; x++) {
            const int px = x * 4;
            const uint8_t b = srcRow[px + 0];
            const uint8_t g = srcRow[px + 1];
            const uint8_t r = srcRow[px + 2];
            int yVal = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
            dstY[x] = static_cast<uint8_t>(clampByte(yVal));
        }
    }

    // UV plane (2x2 box-filtered for crisp, non-jagged UI text & borders)
    #pragma omp parallel for schedule(static)
    for (int y = 0; y < h; y += 2) {
        const uint8_t* srcRow0 = bgra + y * bgraPitch;
        const uint8_t* srcRow1 = bgra + (y + 1 < h ? (y + 1) * bgraPitch : y * bgraPitch);
        uint8_t* dstUV = uvPlane + (y / 2) * w;
        for (int x = 0; x < w; x += 2) {
            const int x0 = x * 4;
            const int x1 = (x + 1 < w ? x + 1 : x) * 4;
            const int r = (srcRow0[x0 + 2] + srcRow0[x1 + 2] + srcRow1[x0 + 2] + srcRow1[x1 + 2] + 2) >> 2;
            const int g = (srcRow0[x0 + 1] + srcRow0[x1 + 1] + srcRow1[x0 + 1] + srcRow1[x1 + 1] + 2) >> 2;
            const int b = (srcRow0[x0 + 0] + srcRow0[x1 + 0] + srcRow1[x0 + 0] + srcRow1[x1 + 0] + 2) >> 2;

            int u = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
            int v = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
            dstUV[x] = static_cast<uint8_t>(clampByte(u));
            dstUV[x + 1] = static_cast<uint8_t>(clampByte(v));
        }
    }
}

bool MFEncoder::writeRgb32SampleLocked(const uint8_t* bgra, int bgraPitch, int64_t timestampHns) {
    // MF RGB32 expects bottom-up bitmap unless we set MF_MT_DEFAULT_STRIDE
    // Convert BGRA top-down to BGRA bottom-up for MF compatibility
    const size_t rowBytes = static_cast<size_t>(width_) * 4;
    const size_t totalBytes = rowBytes * height_;

    // MF RGB32 is stored bottom-up
    for (int y = 0; y < height_; y++) {
        const uint8_t* srcRow = bgra + y * bgraPitch;
        uint8_t* dstRow = rgbBuffer_.data() + (height_ - 1 - y) * rowBytes;
        std::memcpy(dstRow, srcRow, rowBytes);
    }

    // Create MF sample from RGB buffer
    DWORD bufferSize = static_cast<DWORD>(totalBytes);
    ComPtr<IMFMediaBuffer> buffer;
    HRESULT hr = MFCreateMemoryBuffer(bufferSize, &buffer);
    if (FAILED(hr)) return false;

    BYTE* bufferData = nullptr;
    hr = buffer->Lock(&bufferData, nullptr, nullptr);
    if (FAILED(hr)) return false;

    std::memcpy(bufferData, rgbBuffer_.data(), bufferSize);
    buffer->Unlock();
    buffer->SetCurrentLength(bufferSize);

    ComPtr<IMFSample> sample;
    hr = MFCreateSample(&sample);
    if (FAILED(hr)) return false;

    sample->AddBuffer(buffer.Get());
    sample->SetSampleTime(timestampHns);

    const int64_t frameDurationHns = 10000000LL / fps_;
    sample->SetSampleDuration(frameDurationHns);

    hr = sinkWriter_->WriteSample(streamIndex_, sample.Get());
    if (FAILED(hr)) {
        std::cerr << "ERROR: WriteSample (RGB32) failed: 0x" << std::hex << hr << std::endl;
    }
    return SUCCEEDED(hr);
}

bool MFEncoder::extendLastFrameTo(int64_t timestampHns) {
    std::lock_guard<std::mutex> lock(mutex_);

    int64_t normalizedTimestampHns = 0;
    if (!normalizeTimelineTimestampHnsLocked(timestampHns, normalizedTimestampHns)) {
        return false;
    }

    return extendLastFrameToLocked(normalizedTimestampHns);
}

void MFEncoder::normalizeWriteTimestampHnsLocked(int64_t timestampHns, int64_t& normalizedTimestampHns) {
    if (firstSampleTimeHns_ < 0) {
        firstSampleTimeHns_ = timestampHns < 0 ? 0 : timestampHns;
    }

    normalizedTimestampHns = timestampHns - firstSampleTimeHns_;
    if (normalizedTimestampHns < 0) {
        normalizedTimestampHns = 0;
    }
}

bool MFEncoder::normalizeTimelineTimestampHnsLocked(
    int64_t timestampHns,
    int64_t& normalizedTimestampHns
) const {
    if (firstSampleTimeHns_ < 0) return false;

    normalizedTimestampHns = timestampHns - firstSampleTimeHns_;
    if (normalizedTimestampHns < 0) {
        normalizedTimestampHns = 0;
    }
    return true;
}

bool MFEncoder::extendLastFrameToLocked(int64_t timestampHns) {
    if (!initialized_ || !sinkWriter_) return false;
    if (fps_ <= 0) return false;

    const bool hasFrameData = useRgbInput_ ? !rgbFrameBuffer_.empty() : !lastFrameBuffer_.empty();
    if (!hasFrameData) return false;
    if (lastSampleTimeHns_ < 0) return false;

    const int64_t frameDurationHns = 10000000LL / fps_;
    if (frameDurationHns <= 0) return false;
    if (timestampHns <= lastSampleTimeHns_ + frameDurationHns) {
        return true;
    }

    int64_t nextSampleTimeHns = lastSampleTimeHns_ + frameDurationHns;
    while (nextSampleTimeHns + frameDurationHns <= timestampHns) {
        bool wrote = false;
        if (useRgbInput_) {
            // Re-write the stored RGB frame
            wrote = writeRgb32SampleLocked(rgbFrameBuffer_.data(), width_ * 4, nextSampleTimeHns);
        } else {
            wrote = writeNv12SampleLocked(lastFrameBuffer_, nextSampleTimeHns);
        }
        if (!wrote) return false;
        lastSampleTimeHns_ = nextSampleTimeHns;
        nextSampleTimeHns += frameDurationHns;
    }

    return true;
}

bool MFEncoder::writeNv12SampleLocked(const std::vector<uint8_t>& frameBuffer, int64_t timestampHns) {
    if (frameBuffer.empty()) return false;
    if (fps_ <= 0) return false;

    const int64_t frameDurationHns = 10000000LL / fps_;
    if (frameDurationHns <= 0) return false;

    // Create MF sample
    DWORD bufferSize = static_cast<DWORD>(frameBuffer.size());
    ComPtr<IMFMediaBuffer> buffer;
    HRESULT hr = MFCreateMemoryBuffer(bufferSize, &buffer);
    if (FAILED(hr)) return false;

    BYTE* bufferData = nullptr;
    hr = buffer->Lock(&bufferData, nullptr, nullptr);
    if (FAILED(hr)) return false;

    std::memcpy(bufferData, frameBuffer.data(), bufferSize);
    buffer->Unlock();
    buffer->SetCurrentLength(bufferSize);

    ComPtr<IMFSample> sample;
    hr = MFCreateSample(&sample);
    if (FAILED(hr)) return false;

    sample->AddBuffer(buffer.Get());
    sample->SetSampleTime(timestampHns);
    sample->SetSampleDuration(frameDurationHns);

    hr = sinkWriter_->WriteSample(streamIndex_, sample.Get());
    if (FAILED(hr)) {
        std::cerr << "ERROR: WriteSample failed: 0x" << std::hex << hr << std::endl;
    }
    return SUCCEEDED(hr);
}

bool MFEncoder::finalize() {
    std::lock_guard<std::mutex> lock(mutex_);

    if (!initialized_) return false;
    if (!sinkWriter_) return false;

    HRESULT hr = sinkWriter_->Finalize();
    if (FAILED(hr)) {
        std::cerr << "ERROR: SinkWriter Finalize failed: 0x" << std::hex << hr << std::endl;
    }

    initialized_ = false;
    sinkWriter_.Reset();
    stagingTexture_.Reset();
    resizeCompositeView_.Reset();
    resizeCompositeTexture_.Reset();
    nv12Buffer_.clear();
    rgbBuffer_.clear();
    rgbFrameBuffer_.clear();
    lastFrameBuffer_.clear();
    nv12Buffer_.shrink_to_fit();
    rgbBuffer_.shrink_to_fit();
    rgbFrameBuffer_.shrink_to_fit();
    lastFrameBuffer_.shrink_to_fit();
    firstSampleTimeHns_ = -1;
    lastSampleTimeHns_ = -1;
    MFShutdown();
    return SUCCEEDED(hr);
}
