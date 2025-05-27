{
  "targets": [
    {
      "target_name": "audio_controller",
      "sources": [ 
        "native/audio-controller.cpp" 
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [ 
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "ole32.lib"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "AdditionalIncludeDirectories": [
                "<!@(node -p \"require('node-addon-api').include\")"
              ]
            }
          }
        }]
      ]
    }
  ]
}