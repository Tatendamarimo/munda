import UIKit
import Network
import Capacitor
import FirebaseCore
import FirebaseAppCheck
import FirebaseAILogic

public enum MundaNative {
    public static func configure() {
        guard FirebaseApp.app() == nil,
              let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
              let options = FirebaseOptions(contentsOfFile: path) else { return }
        #if DEBUG
        AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
        #else
        AppCheck.setAppCheckProviderFactory(MundaAttestationFactory())
        #endif
        FirebaseApp.configure(options: options)
    }
}

private final class MundaAttestationFactory: NSObject, AppCheckProviderFactory {
    func createProvider(with app: FirebaseApp) -> AppCheckProvider? {
        if #available(iOS 14.0, *) { return AppAttestProvider(app: app) }
        return DeviceCheckProvider(app: app)
    }
}

@objc(MundaAppleAIPlugin)
public final class MundaAppleAIPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MundaAppleAIPlugin"
    public let jsName = "MundaAppleAI"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "generate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appCheckToken", returnType: CAPPluginReturnPromise)
    ]
    private var generating = false
    private let networkMonitor = NWPathMonitor()

    public override func load() {
        networkMonitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.notifyListeners("networkStatus", data: ["connected": path.status == .satisfied], retainUntilConsumed: true)
            }
        }
        networkMonitor.start(queue: DispatchQueue(label: "app.munda.network"))
    }

    deinit { networkMonitor.cancel() }

    @objc public func status(_ call: CAPPluginCall) {
        guard FirebaseApp.app() != nil else {
            call.resolve(["state": "UNAVAILABLE", "detail": "Munda’s native Firebase configuration is missing. Complete the iOS setup before using AI."]); return
        }
        let model = FirebaseAI.SystemLanguageModel.default
        let state: String
        let detail: String
        switch model.availability {
        case .available:
            state = "AVAILABLE"
            detail = "Apple on-device AI is ready for text notes. Photos need a connection."
        case .unavailable(let reason):
            switch reason {
            case .modelNotReady:
                state = "DOWNLOADING"
                detail = "Apple’s local model is not ready yet. Keep the iPhone on Wi-Fi and power, and check its download in Settings → Apple Intelligence & Siri."
            case .appleIntelligenceNotEnabled:
                state = "UNAVAILABLE"
                detail = "Enable Apple Intelligence in Settings → Apple Intelligence & Siri to prepare offline text analysis. Photos need a connection."
            case .deviceNotEligible:
                state = "UNAVAILABLE"
                detail = "This iPhone or iOS version cannot run Apple’s local model. Cloud analysis works when connected; observations are saved offline for later."
            case .unknown:
                state = "UNAVAILABLE"
                detail = "Apple on-device AI is temporarily unavailable. Reopen Munda to check again, or use cloud analysis when connected."
            }
        }
        call.resolve(["state": state, "detail": detail])
    }

    @objc public func generate(_ call: CAPPluginCall) {
        guard let prompt = call.getString("prompt"), let schema = call.getString("schema"),
              !prompt.isEmpty, prompt.count + schema.count <= 16000 else {
            call.reject("The note is empty or too long for local analysis."); return
        }
        Task { @MainActor in
            guard UIApplication.shared.applicationState == .active else { call.reject("Keep Munda open during local analysis."); return }
            guard !generating else { call.reject("Local AI is busy. Please try again."); return }
            guard FirebaseApp.app() != nil else { call.reject("Native Firebase configuration is missing."); return }
            guard FirebaseAI.SystemLanguageModel.default.isAvailable else { call.reject("Apple on-device AI is not ready."); return }
            generating = true
            defer { generating = false }
            do {
                // System-only: never silently send a farmer's offline text to the cloud.
                // A new session for each request prevents cross-record chat history.
                let ai = FirebaseAI.firebaseAI(backend: .googleAI())
                let session = ai.generativeModelSession(model: FirebaseAI.SystemLanguageModel.default)
                let response = try await session.respond(to: prompt + "\nReturn only valid JSON matching this schema. Do not wrap it in markdown:\n" + schema)
                call.resolve(["text": response.content, "source": "ON_DEVICE"])
            } catch { call.reject("Local analysis could not finish. \(error.localizedDescription)") }
        }
    }

    @objc public func appCheckToken(_ call: CAPPluginCall) {
        guard FirebaseApp.app() != nil else { call.reject("Add the Firebase iOS configuration before connecting."); return }
        AppCheck.appCheck().token(forcingRefresh: false) { token, error in
            guard let token else { call.reject("App verification failed. \(error?.localizedDescription ?? "Try again later.")"); return }
            call.resolve(["token": token.token, "expireTimeMillis": token.expirationDate.timeIntervalSince1970 * 1000])
        }
    }
}

public final class MundaViewController: CAPBridgeViewController {
    public override func capacitorDidLoad() {
        bridge?.registerPluginInstance(MundaAppleAIPlugin())
    }
}
