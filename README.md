# ocr_ai

An ocr process with tesseract and local llm call dependend on a running llama.cpp server.

## Installation

- https://github.com/countzero/windows_llama.cpp
- https://www.npmjs.com/package/pdf2pic
  - node >= 14.x
  - graphicsmagick
  - ghostscript

Install npm dependencies:

```
npm install
```

### Don't have graphicsmagick and ghostscript yet?

Follow [this](https://github.com/yakovmeister/pdf2image/blob/HEAD/docs/gm-installation.md) guide to install the required dependencies.

## Specifications

Tested with the following specs:

- 13th Gen Intel Core i9-13900KF
- NVIDIA GeForce RTx 4090 - 24GB
- 2x corsair cmk32gx5m2b5600c36 - 32GB
- kingston sfyrd2000g - 2TB

## Usage

### Run llama.cpp

Tested with this quantized [model](https://huggingface.co/TheBloke/dolphin-2_2-yi-34b-GGUF) by TheBloke.

```
 ./vendor/llama.cpp/build/bin/Release/server `
>>     --model ".\vendor\llama.cpp\models\dolphin-2_2-yi-34b.Q4_K_M.gguf" `
>>     --ctx-size 4096 `
>>     --threads 24 `
>>     --n-gpu-layers 64
```

### Add files to be analyzed

Add pdf files you want to be analyzed into the ./input folder.

### Run ocr application

For any needed information run:

```
npm start -- --help
```
