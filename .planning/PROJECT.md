# Project: Recordly — Video Export & Native FFmpeg Pipeline

## Overview
Recordly is an open-source desktop screen recording and editing application built on Electron, React, TypeScript, and native Windows/macOS capture and encoding components.

This initiative focuses on hardening, optimizing, and modernizing the **Video Export & Native Video/FFmpeg Pipeline**, ensuring rock-solid stability, zero audio drift, hardware-accelerated NVENC/D3D11/MF encoding, BT.709 color accuracy, and seamless fallback routing.

## Core Capabilities
- **Native Hardware Encoding**: Media Foundation (Windows WGC/MF), NVENC/CUDA, and Apple VideoToolbox.
- **FFmpeg Subprocess Orchestration**: Robust filtergraphs for zooms, crops, paddings, shadows, squircles, and cinematic looks.
- **Audio Sync & Drift Compensation**: Sub-frame accurate audio-video synchronization with speed ramp (`atempo`) support.
- **Streaming Export Architecture**: Disk-backed temp file streaming to eliminate 32-bit Node Buffer memory exhaustion on long/high-res exports.
- **Reliable Fallback Chains**: Native Hardware -> Software libx264 FFmpeg -> Canvas/WebCodecs fallback.
