// native/audio-controller.cpp
// Native Node.js module for Windows Audio Session control

#include <napi.h>
#include <windows.h>
#include <mmdeviceapi.h>
#include <audiopolicy.h>
#include <endpointvolume.h>
#include <functiondiscoverykeys_devpkey.h>
#include <vector>
#include <string>
#include <codecvt>

#pragma comment(lib, "ole32.lib")

class AudioController : public Napi::ObjectWrap<AudioController> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    AudioController(const Napi::CallbackInfo& info);
    ~AudioController();

private:
    static Napi::FunctionReference constructor;
    
    // Methods
    Napi::Value GetAudioSessions(const Napi::CallbackInfo& info);
    Napi::Value SetApplicationVolume(const Napi::CallbackInfo& info);
    Napi::Value GetApplicationVolume(const Napi::CallbackInfo& info);
    Napi::Value MuteApplication(const Napi::CallbackInfo& info);
    Napi::Value GetSystemVolume(const Napi::CallbackInfo& info);
    Napi::Value SetSystemVolume(const Napi::CallbackInfo& info);
    
    // Helper methods
    std::wstring GetProcessName(DWORD processId);
    IAudioSessionManager2* GetAudioSessionManager();
    
    // COM interfaces
    IMMDeviceEnumerator* pEnumerator;
    IMMDevice* pDevice;
    bool initialized;
};

Napi::FunctionReference AudioController::constructor;

Napi::Object AudioController::Init(Napi::Env env, Napi::Object exports) {
    Napi::HandleScope scope(env);

    Napi::Function func = DefineClass(env, "AudioController", {
        InstanceMethod("getAudioSessions", &AudioController::GetAudioSessions),
        InstanceMethod("setApplicationVolume", &AudioController::SetApplicationVolume),
        InstanceMethod("getApplicationVolume", &AudioController::GetApplicationVolume),
        InstanceMethod("muteApplication", &AudioController::MuteApplication),
        InstanceMethod("getSystemVolume", &AudioController::GetSystemVolume),
        InstanceMethod("setSystemVolume", &AudioController::SetSystemVolume),
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("AudioController", func);
    return exports;
}

AudioController::AudioController(const Napi::CallbackInfo& info) 
    : Napi::ObjectWrap<AudioController>(info), pEnumerator(nullptr), pDevice(nullptr), initialized(false) {
    
    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    if (SUCCEEDED(hr)) {
        hr = CoCreateInstance(
            __uuidof(MMDeviceEnumerator), NULL,
            CLSCTX_ALL, __uuidof(IMMDeviceEnumerator),
            (void**)&pEnumerator
        );

        if (SUCCEEDED(hr)) {
            hr = pEnumerator->GetDefaultAudioEndpoint(
                eRender, eConsole, &pDevice
            );
            
            if (SUCCEEDED(hr)) {
                initialized = true;
            }
        }
    }
}

AudioController::~AudioController() {
    if (pDevice) pDevice->Release();
    if (pEnumerator) pEnumerator->Release();
    CoUninitialize();
}

std::wstring AudioController::GetProcessName(DWORD processId) {
    std::wstring processName = L"Unknown";
    
    HANDLE hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, processId);
    if (hProcess) {
        WCHAR szProcessName[MAX_PATH] = L"";
        DWORD dwSize = MAX_PATH;
        
        if (QueryFullProcessImageNameW(hProcess, 0, szProcessName, &dwSize)) {
            std::wstring fullPath(szProcessName);
            size_t pos = fullPath.find_last_of(L"\\/");
            if (pos != std::wstring::npos) {
                processName = fullPath.substr(pos + 1);
            }
        }
        CloseHandle(hProcess);
    }
    
    return processName;
}

IAudioSessionManager2* AudioController::GetAudioSessionManager() {
    if (!initialized || !pDevice) return nullptr;
    
    IAudioSessionManager2* pSessionManager = nullptr;
    HRESULT hr = pDevice->Activate(
        __uuidof(IAudioSessionManager2), CLSCTX_ALL,
        NULL, (void**)&pSessionManager
    );
    
    return SUCCEEDED(hr) ? pSessionManager : nullptr;
}

Napi::Value AudioController::GetAudioSessions(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Array sessions = Napi::Array::New(env);
    
    if (!initialized) {
        return sessions;
    }
    
    IAudioSessionManager2* pSessionManager = GetAudioSessionManager();
    if (!pSessionManager) return sessions;
    
    IAudioSessionEnumerator* pSessionEnumerator = nullptr;
    HRESULT hr = pSessionManager->GetSessionEnumerator(&pSessionEnumerator);
    
    if (SUCCEEDED(hr)) {
        int sessionCount = 0;
        pSessionEnumerator->GetCount(&sessionCount);
        
        int arrayIndex = 0;
        for (int i = 0; i < sessionCount; i++) {
            IAudioSessionControl* pSessionControl = nullptr;
            hr = pSessionEnumerator->GetSession(i, &pSessionControl);
            
            if (SUCCEEDED(hr)) {
                IAudioSessionControl2* pSessionControl2 = nullptr;
                hr = pSessionControl->QueryInterface(__uuidof(IAudioSessionControl2), (void**)&pSessionControl2);
                
                if (SUCCEEDED(hr)) {
                    DWORD processId = 0;
                    hr = pSessionControl2->GetProcessId(&processId);
                    
                    if (SUCCEEDED(hr) && processId != 0) {
                        AudioSessionState state;
                        pSessionControl->GetState(&state);
                        
                        if (state == AudioSessionStateActive) {
                            std::wstring processName = GetProcessName(processId);
                            
                            // Convert to UTF-8
                            std::wstring_convert<std::codecvt_utf8<wchar_t>> converter;
                            std::string processNameUtf8 = converter.to_bytes(processName);
                            
                            // Get display name
                            LPWSTR pDisplayName = nullptr;
                            pSessionControl->GetDisplayName(&pDisplayName);
                            std::string displayName = "";
                            if (pDisplayName) {
                                displayName = converter.to_bytes(pDisplayName);
                                CoTaskMemFree(pDisplayName);
                            }
                            
                            // Get volume
                            ISimpleAudioVolume* pVolume = nullptr;
                            hr = pSessionControl->QueryInterface(__uuidof(ISimpleAudioVolume), (void**)&pVolume);
                            float volume = 0.0f;
                            BOOL muted = FALSE;
                            
                            if (SUCCEEDED(hr)) {
                                pVolume->GetMasterVolume(&volume);
                                pVolume->GetMute(&muted);
                                pVolume->Release();
                            }
                            
                            // Create session object
                            Napi::Object session = Napi::Object::New(env);
                            session.Set("id", processId);
                            session.Set("name", processNameUtf8);
                            session.Set("displayName", displayName.empty() ? processNameUtf8 : displayName);
                            session.Set("volume", static_cast<int>(volume * 100));
                            session.Set("muted", muted ? true : false);
                            
                            sessions.Set(arrayIndex++, session);
                        }
                    }
                    
                    pSessionControl2->Release();
                }
                pSessionControl->Release();
            }
        }
        pSessionEnumerator->Release();
    }
    
    pSessionManager->Release();
    return sessions;
}

Napi::Value AudioController::SetApplicationVolume(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "Expected (processName: string, volume: number)")
            .ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string processName = info[0].As<Napi::String>().Utf8Value();
    float volume = info[1].As<Napi::Number>().FloatValue() / 100.0f;
    
    if (!initialized) {
        return Napi::Boolean::New(env, false);
    }
    
    IAudioSessionManager2* pSessionManager = GetAudioSessionManager();
    if (!pSessionManager) return Napi::Boolean::New(env, false);
    
    IAudioSessionEnumerator* pSessionEnumerator = nullptr;
    HRESULT hr = pSessionManager->GetSessionEnumerator(&pSessionEnumerator);
    bool success = false;
    
    if (SUCCEEDED(hr)) {
        int sessionCount = 0;
        pSessionEnumerator->GetCount(&sessionCount);
        
        for (int i = 0; i < sessionCount; i++) {
            IAudioSessionControl* pSessionControl = nullptr;
            hr = pSessionEnumerator->GetSession(i, &pSessionControl);
            
            if (SUCCEEDED(hr)) {
                IAudioSessionControl2* pSessionControl2 = nullptr;
                hr = pSessionControl->QueryInterface(__uuidof(IAudioSessionControl2), (void**)&pSessionControl2);
                
                if (SUCCEEDED(hr)) {
                    DWORD processId = 0;
                    hr = pSessionControl2->GetProcessId(&processId);
                    
                    if (SUCCEEDED(hr) && processId != 0) {
                        std::wstring procName = GetProcessName(processId);
                        std::wstring_convert<std::codecvt_utf8<wchar_t>> converter;
                        std::string procNameUtf8 = converter.to_bytes(procName);
                        
                        // Case-insensitive comparison
                        std::transform(procNameUtf8.begin(), procNameUtf8.end(), procNameUtf8.begin(), ::tolower);
                        std::string searchName = processName;
                        std::transform(searchName.begin(), searchName.end(), searchName.begin(), ::tolower);
                        
                        if (procNameUtf8.find(searchName) != std::string::npos) {
                            ISimpleAudioVolume* pVolume = nullptr;
                            hr = pSessionControl->QueryInterface(__uuidof(ISimpleAudioVolume), (void**)&pVolume);
                            
                            if (SUCCEEDED(hr)) {
                                hr = pVolume->SetMasterVolume(volume, NULL);
                                success = SUCCEEDED(hr);
                                pVolume->Release();
                            }
                        }
                    }
                    
                    pSessionControl2->Release();
                }
                pSessionControl->Release();
            }
        }
        pSessionEnumerator->Release();
    }
    
    pSessionManager->Release();
    return Napi::Boolean::New(env, success);
}

// Additional methods implementation...
Napi::Value AudioController::MuteApplication(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsBoolean()) {
        Napi::TypeError::New(env, "Expected (processName: string, mute: boolean)")
            .ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string processName = info[0].As<Napi::String>().Utf8Value();
    bool mute = info[1].As<Napi::Boolean>().Value();
    
    // Similar implementation to SetApplicationVolume but using SetMute
    // ...
    
    return Napi::Boolean::New(env, true);
}

Napi::Value AudioController::GetSystemVolume(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!initialized || !pDevice) {
        return Napi::Number::New(env, -1);
    }
    
    IAudioEndpointVolume* pEndpointVolume = nullptr;
    HRESULT hr = pDevice->Activate(
        __uuidof(IAudioEndpointVolume), CLSCTX_ALL,
        NULL, (void**)&pEndpointVolume
    );
    
    if (SUCCEEDED(hr)) {
        float volume = 0.0f;
        hr = pEndpointVolume->GetMasterVolumeLevelScalar(&volume);
        pEndpointVolume->Release();
        
        if (SUCCEEDED(hr)) {
            return Napi::Number::New(env, static_cast<int>(volume * 100));
        }
    }
    
    return Napi::Number::New(env, -1);
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    AudioController::Init(env, exports);
    return exports;
}

NODE_API_MODULE(audio_controller, Init)