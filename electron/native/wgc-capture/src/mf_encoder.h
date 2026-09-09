#pragma once

#include <windows.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <d3d11.h>
#include <wrl/client.h>
#include <mutex>
#include <string>
#include <vector>

using Microsoft::WRL::ComPtr;

enum class QualityPreset { Low = 0, Medium = 1, High = 2, Ultra = 3, PixelPerfect = 4 };

class MFEncoder {
public:
    MFEncoder();
    ~MFEncoder();

    bool initialize(const std::wstring& outputPath, int width, int height, int fps,
                    ID3D11Device* device, ID3D11DeviceContext* context, int qualityPreset = 2);
    bool writeFrame(ID3D11Texture2D* texture, int64_t timestampHns);
    bool extendLastFrameTo(int64_t timestampHns);
    bool finalize();

private:
    void normalizeWriteTimestampHnsLocked(int64_t timestampHns, int64_t& normalizedTimestampHns);
    bool normalizeTimelineTimestampHnsLocked(int64_t timestampHns, int64_t& normalizedTimestampHns) const;
    bool extendLastFrameToLocked(int64_t timestampHns);
    bool writeNv12SampleLocked(const std::vector<uint8_t>& frameBuffer, int64_t timestampHns);
    bool writeRgb32SampleLocked(const uint8_t* rgbData, int stride, int64_t timestampHns);
    void convertBgraToNv12(const uint8_t* bgra, int bgraPitch);

    ComPtr<IMFSinkWriter> sinkWriter_;
    ID3D11Device* device_ = nullptr;
    ID3D11DeviceContext* context_ = nullptr;
    ComPtr<ID3D11Texture2D> stagingTexture_;
    ComPtr<ID3D11Texture2D> resizeCompositeTexture_;
    ComPtr<ID3D11RenderTargetView> resizeCompositeView_;
    std::vector<uint8_t> nv12Buffer_;
    std::vector<uint8_t> rgbBuffer_;
    std::vector<uint8_t> rgbFrameBuffer_;
    std::vector<uint8_t> lastFrameBuffer_;
    DWORD streamIndex_ = 0;
    int width_ = 0;
    int height_ = 0;
    int fps_ = 60;
    QualityPreset quality_ = QualityPreset::Medium;
    bool useRgbInput_ = false;
    int64_t firstSampleTimeHns_ = -1;
    int64_t lastSampleTimeHns_ = -1;
    bool initialized_ = false;
    std::mutex mutex_;
};
