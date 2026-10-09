// iPhone side of the shared device layer (native/shared/.../platform/Device.kt):
// camera, photo library, barcode/QR scanner, OCR, speech, share sheet and
// Face ID/Touch ID. Registered in HelloCalApp.swift as Device.shared.platform.
// Every callback is called exactly once, on the main thread.
import AVFoundation
import LocalAuthentication
import PhotosUI
import Shared
import Speech
import UIKit
import UniformTypeIdentifiers
import Vision

final class IosDevice: NSObject, DevicePlatform {
    static let shared = IosDevice()

    /// Keeps the delegate of the picker/scanner on screen alive.
    private var activeDelegate: AnyObject?
    private let work = DispatchQueue(label: "dk.packroff.hellocal.device", qos: .userInitiated)
    private var speech: SpeechSession?
    private var speechGeneration = 0

    // MARK: - Camera and photo library

    func takePhoto(maxEdge: Int32, quality: Double, onResult: @escaping (KotlinByteArray?, String?) -> Void) {
        onMain {
            guard UIImagePickerController.isSourceTypeAvailable(.camera) else { onResult(nil, "unavailable"); return }
            self.cameraAccess { granted in
                guard granted else { onResult(nil, "denied"); return }
                guard let top = IosDevice.topViewController() else { onResult(nil, "unavailable"); return }
                let picker = UIImagePickerController()
                picker.sourceType = .camera
                let delegate = CameraDelegate { image in
                    self.activeDelegate = nil
                    guard let image else { onResult(nil, nil); return }
                    self.work.async {
                        let jpeg = ImageTools.jpeg(image, maxWidth: CGFloat(maxEdge), maxHeight: CGFloat(maxEdge), quality: quality)
                        let bytes = jpeg.map { DataBridge.shared.toByteArray(data: $0) }
                        DispatchQueue.main.async { onResult(bytes, bytes == nil ? "failed" : nil) }
                    }
                }
                self.activeDelegate = delegate
                picker.delegate = delegate
                top.present(picker, animated: true)
            }
        }
    }

    func pickPhotos(max: Int32, maxEdge: Int32, quality: Double, onResult: @escaping ([KotlinByteArray], String?) -> Void) {
        presentPhotoPicker(filter: .images, limit: Int(max)) { providers in
            guard let providers, !providers.isEmpty else { onResult([], nil); return }
            let results = ResultBox<Data>(count: providers.count)
            let group = DispatchGroup()
            for (index, provider) in providers.enumerated() {
                group.enter()
                provider.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) { data, _ in
                    let jpeg = data.flatMap { UIImage(data: $0) }.flatMap {
                        ImageTools.jpeg($0, maxWidth: CGFloat(maxEdge), maxHeight: CGFloat(maxEdge), quality: quality)
                    }
                    results.set(index, jpeg)
                    group.leave()
                }
            }
            group.notify(queue: .main) {
                let photos = results.values.compactMap { $0 }
                onResult(photos.map { DataBridge.shared.toByteArray(data: $0) }, photos.count < providers.count ? "partial" : nil)
            }
        }
    }

    func pickFiles(onResult: @escaping ([PickedFile]?, String?) -> Void) {
        presentPhotoPicker(filter: .any(of: [.images, .videos]), limit: 0) { providers in
            guard let providers, !providers.isEmpty else { onResult(nil, nil); return }
            let results = ResultBox<PickedFile>(count: providers.count)
            let group = DispatchGroup()
            for (index, provider) in providers.enumerated() {
                group.enter()
                if provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
                    provider.loadFileRepresentation(forTypeIdentifier: UTType.movie.identifier) { url, _ in
                        // The file is deleted when this block returns, so read it now.
                        if let url, let data = try? Data(contentsOf: url) {
                            let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType
                            let videoMime = (mime?.hasPrefix("video/") == true) ? mime! : "video/quicktime"
                            results.set(index, PickedFile(mime: videoMime, bytes: DataBridge.shared.toByteArray(data: data)))
                        }
                        group.leave()
                    }
                } else {
                    let mime = provider.registeredTypeIdentifiers.compactMap { UTType($0)?.preferredMIMEType }.first(where: { $0.hasPrefix("image/") })
                    provider.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) { data, _ in
                        if let data {
                            results.set(index, PickedFile(mime: mime ?? "image/jpeg", bytes: DataBridge.shared.toByteArray(data: data)))
                        }
                        group.leave()
                    }
                }
            }
            group.notify(queue: .main) {
                let files = results.values.compactMap { $0 }
                onResult(files, files.count < providers.count ? "partial" : nil)
            }
        }
    }

    func scaleImage(image: KotlinByteArray, maxWidth: Int32, maxHeight: Int32, quality: Double, onResult: @escaping (KotlinByteArray?) -> Void) {
        let data = DataBridge.shared.toData(bytes: image)
        work.async {
            let jpeg = UIImage(data: data).flatMap {
                ImageTools.jpeg($0, maxWidth: CGFloat(maxWidth), maxHeight: CGFloat(maxHeight), quality: quality)
            }
            let bytes = jpeg.map { DataBridge.shared.toByteArray(data: $0) }
            DispatchQueue.main.async { onResult(bytes) }
        }
    }

    func videoFrames(video: KotlinByteArray, mime: String, stepSeconds: Double, maxWidth: Int32, quality: Double, onResult: @escaping ([VideoFrame], String?) -> Void) {
        let data = DataBridge.shared.toData(bytes: video)
        let ext = mime.contains("quicktime") ? "mov" : "mp4"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("hellocal-import-\(UUID().uuidString).\(ext)")
        let step = stepSeconds > 0 ? stepSeconds : 1.2
        let width = CGFloat(maxWidth)
        let jpegQuality = CGFloat(quality)
        Task.detached(priority: .userInitiated) {
            var frames: [VideoFrame] = []
            var failure: String?
            do {
                try data.write(to: url)
                let asset = AVURLAsset(url: url)
                let seconds = try await asset.load(.duration).seconds
                let duration = seconds.isFinite ? seconds : 0
                let generator = AVAssetImageGenerator(asset: asset)
                generator.appliesPreferredTrackTransform = true
                generator.requestedTimeToleranceBefore = CMTime(value: 1, timescale: 20)
                generator.requestedTimeToleranceAfter = CMTime(value: 1, timescale: 20)
                // src/lib/video-frames.ts: from 0.2 s, every step, the last clamped to just before the end.
                var time = 0.2
                while time < Swift.max(duration, 0.3) {
                    let at = Swift.min(time, Swift.max(0, duration - 0.05))
                    if let cgImage = try? await generator.image(at: CMTime(seconds: at, preferredTimescale: 600)).image {
                        let scaled = ImageTools.scaled(UIImage(cgImage: cgImage), maxWidth: width, maxHeight: .greatestFiniteMagnitude)
                        if let jpeg = scaled.jpegData(compressionQuality: jpegQuality), let scaledCg = scaled.cgImage {
                            frames.append(VideoFrame(
                                jpeg: DataBridge.shared.toByteArray(data: jpeg),
                                grey16: DataBridge.shared.toByteArray(data: ImageTools.grey16(scaledCg))
                            ))
                        }
                    }
                    time += step
                }
            } catch {
                failure = "failed"
            }
            try? FileManager.default.removeItem(at: url)
            let result = frames
            let error = failure
            DispatchQueue.main.async { onResult(result, error) }
        }
    }

    // MARK: - OCR and barcodes

    func recognizeText(image: KotlinByteArray, languages: [String], onResult: @escaping (Shared.RecognizedText?) -> Void) {
        let data = DataBridge.shared.toData(bytes: image)
        work.async {
            var result: Shared.RecognizedText?
            if let ui = UIImage(data: data), let cgImage = ImageTools.scaled(ui, maxWidth: 2400, maxHeight: 2400).cgImage {
                let request = VNRecognizeTextRequest()
                request.recognitionLevel = .accurate
                request.usesLanguageCorrection = true
                if let supported = try? request.supportedRecognitionLanguages() {
                    let chosen = languages.compactMap { tag -> String? in
                        if supported.contains(tag) { return tag }
                        let prefix = String(tag.prefix(2))
                        return supported.first(where: { $0.hasPrefix(prefix) }) ?? (prefix == "nb" ? supported.first(where: { $0.hasPrefix("no") }) : nil)
                    }
                    if !chosen.isEmpty { request.recognitionLanguages = chosen }
                }
                do {
                    try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
                    let candidates = (request.results ?? []).compactMap { $0.topCandidates(1).first }
                    let text = candidates.map { $0.string }.joined(separator: "\n")
                    let confidence = candidates.isEmpty ? 0 : candidates.map { Double($0.confidence) }.reduce(0, +) / Double(candidates.count) * 100
                    result = Shared.RecognizedText(text: text, confidence: confidence)
                } catch {
                    result = nil
                }
            }
            DispatchQueue.main.async { onResult(result) }
        }
    }

    func decodeBarcode(image: KotlinByteArray, onResult: @escaping (String?) -> Void) {
        let data = DataBridge.shared.toData(bytes: image)
        work.async {
            var code: String?
            if let ui = UIImage(data: data), let cgImage = ImageTools.scaled(ui, maxWidth: 2400, maxHeight: 2400).cgImage {
                let request = VNDetectBarcodesRequest()
                request.symbologies = [.ean13, .ean8, .upce]
                try? VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
                code = (request.results ?? []).compactMap { $0.payloadStringValue }.first
            }
            DispatchQueue.main.async { onResult(code) }
        }
    }

    func scanBarcode(onResult: @escaping (String?, String?) -> Void) {
        scanCode(types: [.ean13, .ean8, .upce], onResult: onResult)
    }

    func scanQrCode(onResult: @escaping (String?, String?) -> Void) {
        scanCode(types: [.qr], onResult: onResult)
    }

    private func scanCode(types: [AVMetadataObject.ObjectType], onResult: @escaping (String?, String?) -> Void) {
        onMain {
            guard AVCaptureDevice.default(for: .video) != nil else { onResult(nil, "unavailable"); return }
            self.cameraAccess { granted in
                guard granted else { onResult(nil, "denied"); return }
                guard let top = IosDevice.topViewController() else { onResult(nil, "unavailable"); return }
                let scanner = CodeScannerViewController(types: types) { value in onResult(value, nil) }
                top.present(scanner, animated: true)
            }
        }
    }

    // MARK: - Speech

    func startSpeech(languageTag: String, onPartial: @escaping (String) -> Void, onFinished: @escaping (String?, String?) -> Void) {
        onMain {
            self.speech?.cancel()
            self.speech = nil
            self.speechGeneration += 1
            let generation = self.speechGeneration
            SFSpeechRecognizer.requestAuthorization { status in
                AVAudioApplication.requestRecordPermission { granted in
                    DispatchQueue.main.async {
                        // Stopped or restarted while the permission question was shown.
                        guard generation == self.speechGeneration else { onFinished(nil, nil); return }
                        guard status == .authorized, granted else { onFinished(nil, "denied"); return }
                        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: languageTag)) ?? SFSpeechRecognizer(),
                              recognizer.isAvailable
                        else { onFinished(nil, "unavailable"); return }
                        let session = SpeechSession(recognizer: recognizer, onPartial: onPartial) { [weak self] text, error in
                            if let self, generation == self.speechGeneration { self.speech = nil }
                            onFinished(text, error)
                        }
                        self.speech = session
                        session.start()
                    }
                }
            }
        }
    }

    func stopSpeech() {
        onMain {
            self.speechGeneration += 1
            self.speech?.stop()
        }
    }

    // MARK: - Share and confirmation

    func share(title: String, text: String, url: String?) -> Bool {
        guard let top = IosDevice.topViewController() else { return false }
        var items: [Any] = []
        if !text.isEmpty { items.append(text) }
        if let url, !url.isEmpty, !text.contains(url) {
            if let link = URL(string: url) { items.append(link) } else { items.append(url) }
        }
        guard !items.isEmpty else { return false }
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let popover = controller.popoverPresentationController {
            popover.sourceView = top.view
            popover.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.maxY - 80, width: 1, height: 1)
        }
        top.present(controller, animated: true)
        return true
    }

    func canConfirmOwner() -> Bool {
        LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
    }

    func confirmOnDevice(reason: String, onResult: @escaping (KotlinBoolean) -> Void) {
        let context = LAContext()
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason.isEmpty ? "Hello Cal" : reason) { ok, _ in
            DispatchQueue.main.async { onResult(KotlinBoolean(bool: ok)) }
        }
    }

    // MARK: - Needs external accounts (see native/README.md)

    // TODO(platform): passkeys need Associated Domains (webcredentials:hellocal.packroff.dk
    // + apple-app-site-association on the server) and ASAuthorizationPlatformPublicKeyCredentialProvider.
    func passkeySupported() -> Bool { false }

    func hasPasskeyOnDevice() -> Bool { false }

    func registerPasskey(onResult: @escaping (String?) -> Void) { onResult("unsupported") }

    // TODO(platform): push needs the Push Notifications capability + an APNs key on the server.
    func enablePush(onResult: @escaping (String) -> Void) { onResult("unsupported") }

    // MARK: - Helpers

    private func onMain(_ block: @escaping () -> Void) {
        if Thread.isMainThread { block() } else { DispatchQueue.main.async(execute: block) }
    }

    private func cameraAccess(_ done: @escaping (Bool) -> Void) {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            done(true)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in DispatchQueue.main.async { done(granted) } }
        default:
            done(false)
        }
    }

    private func presentPhotoPicker(filter: PHPickerFilter, limit: Int, completion: @escaping ([NSItemProvider]?) -> Void) {
        onMain {
            guard let top = IosDevice.topViewController() else { completion(nil); return }
            var config = PHPickerConfiguration()
            config.filter = filter
            config.selectionLimit = limit < 0 ? 0 : limit // 0 = no limit
            config.preferredAssetRepresentationMode = .current
            let picker = PHPickerViewController(configuration: config)
            let delegate = PhotoPickerDelegate { providers in
                self.activeDelegate = nil
                completion(providers)
            }
            self.activeDelegate = delegate
            picker.delegate = delegate
            top.present(picker, animated: true) {
                picker.presentationController?.delegate = delegate
            }
        }
    }

    static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let windows = scenes.flatMap { $0.windows }
        var top = (windows.first(where: { $0.isKeyWindow }) ?? windows.first)?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}

/// Collects results from several background callbacks in their original order.
private final class ResultBox<T> {
    private let lock = NSLock()
    private var items: [T?]

    init(count: Int) { items = Array(repeating: nil, count: count) }

    func set(_ index: Int, _ value: T?) {
        lock.lock()
        items[index] = value
        lock.unlock()
    }

    var values: [T?] {
        lock.lock()
        defer { lock.unlock() }
        return items
    }
}

// MARK: - Image helpers

enum ImageTools {
    /// Fits the image into maxWidth×maxHeight (never up-scales), orientation applied, on white.
    static func scaled(_ image: UIImage, maxWidth: CGFloat, maxHeight: CGFloat) -> UIImage {
        let size = image.size
        guard size.width > 0, size.height > 0 else { return image }
        let scale = min(1, maxWidth / size.width, maxHeight / size.height)
        let target = CGSize(width: max(1, (size.width * scale).rounded()), height: max(1, (size.height * scale).rounded()))
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: target, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: target))
            image.draw(in: CGRect(origin: .zero, size: target))
        }
    }

    static func jpeg(_ image: UIImage, maxWidth: CGFloat, maxHeight: CGFloat, quality: Double) -> Data? {
        scaled(image, maxWidth: maxWidth, maxHeight: maxHeight).jpegData(compressionQuality: CGFloat(quality))
    }

    /// 16×16 grey fingerprint, (r+g+b)/3 per pixel — src/lib/video-frames.ts fingerprint().
    static func grey16(_ image: CGImage) -> Data {
        var pixels = [UInt8](repeating: 0, count: 16 * 16 * 4)
        let drawn: Bool = pixels.withUnsafeMutableBytes { (buffer: UnsafeMutableRawBufferPointer) -> Bool in
            guard let context = CGContext(
                data: buffer.baseAddress,
                width: 16,
                height: 16,
                bitsPerComponent: 8,
                bytesPerRow: 64,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return false }
            context.interpolationQuality = .medium
            context.draw(image, in: CGRect(x: 0, y: 0, width: 16, height: 16))
            return true
        }
        guard drawn else { return Data() }
        var grey = Data(count: 256)
        for i in 0..<256 {
            let sum = Int(pixels[i * 4]) + Int(pixels[i * 4 + 1]) + Int(pixels[i * 4 + 2])
            grey[i] = UInt8(sum / 3)
        }
        return grey
    }
}

// MARK: - Picker delegates

private final class CameraDelegate: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    private var done: ((UIImage?) -> Void)?

    init(done: @escaping (UIImage?) -> Void) { self.done = done }

    private func finish(_ image: UIImage?) {
        let callback = done
        done = nil
        callback?(image)
    }

    func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        let image = info[.originalImage] as? UIImage
        picker.dismiss(animated: true) { self.finish(image) }
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true) { self.finish(nil) }
    }
}

private final class PhotoPickerDelegate: NSObject, PHPickerViewControllerDelegate, UIAdaptivePresentationControllerDelegate {
    private var done: (([NSItemProvider]?) -> Void)?

    init(done: @escaping ([NSItemProvider]?) -> Void) { self.done = done }

    private func finish(_ providers: [NSItemProvider]?) {
        let callback = done
        done = nil
        callback?(providers)
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        let providers = results.map { $0.itemProvider }
        picker.dismiss(animated: true) { self.finish(providers.isEmpty ? nil : providers) }
    }

    // Swiped down instead of "Cancel".
    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        finish(nil)
    }
}

// MARK: - Barcode / QR scanner (AVFoundation — works on every iPhone, unlike VisionKit's DataScanner)

private final class CodeScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    private let session = AVCaptureSession()
    private let types: [AVMetadataObject.ObjectType]
    private var done: ((String?) -> Void)?
    private var preview: AVCaptureVideoPreviewLayer?

    init(types: [AVMetadataObject.ObjectType], done: @escaping (String?) -> Void) {
        self.types = types
        self.done = done
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        if let camera = AVCaptureDevice.default(for: .video),
           let input = try? AVCaptureDeviceInput(device: camera),
           session.canAddInput(input) {
            session.addInput(input)
            let output = AVCaptureMetadataOutput()
            if session.canAddOutput(output) {
                session.addOutput(output)
                output.setMetadataObjectsDelegate(self, queue: .main)
                output.metadataObjectTypes = types.filter { output.availableMetadataObjectTypes.contains($0) }
            }
            let layer = AVCaptureVideoPreviewLayer(session: session)
            layer.videoGravity = .resizeAspectFill
            layer.frame = view.bounds
            view.layer.addSublayer(layer)
            preview = layer
        }

        // Aiming frame.
        let frame = UIView()
        frame.translatesAutoresizingMaskIntoConstraints = false
        frame.layer.borderColor = UIColor.white.cgColor
        frame.layer.borderWidth = 2
        frame.layer.cornerRadius = 16
        frame.isUserInteractionEnabled = false
        view.addSubview(frame)

        let close = UIButton(type: .system)
        close.translatesAutoresizingMaskIntoConstraints = false
        close.setImage(UIImage(systemName: "xmark"), for: .normal)
        close.tintColor = .white
        close.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        close.layer.cornerRadius = 22
        close.accessibilityLabel = "Luk"
        close.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        view.addSubview(close)

        NSLayoutConstraint.activate([
            frame.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            frame.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            frame.widthAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.75),
            frame.heightAnchor.constraint(equalTo: frame.widthAnchor, multiplier: types.contains(.qr) ? 1 : 0.6),
            close.widthAnchor.constraint(equalToConstant: 44),
            close.heightAnchor.constraint(equalToConstant: 44),
            close.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            close.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
        ])
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview?.frame = view.bounds
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        let session = self.session
        DispatchQueue.global(qos: .userInitiated).async {
            if !session.isRunning { session.startRunning() }
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        let session = self.session
        DispatchQueue.global(qos: .userInitiated).async {
            if session.isRunning { session.stopRunning() }
        }
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard done != nil,
              let value = metadataObjects.compactMap({ ($0 as? AVMetadataMachineReadableCodeObject)?.stringValue }).first
        else { return }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        finish(value)
    }

    @objc private func closeTapped() {
        finish(nil)
    }

    private func finish(_ value: String?) {
        guard let callback = done else { return }
        done = nil
        dismiss(animated: true) { callback(value) }
    }
}

// MARK: - Speech session (SFSpeechRecognizer + AVAudioEngine)

private final class SpeechSession {
    private let recognizer: SFSpeechRecognizer
    private let engine = AVAudioEngine()
    private let request = SFSpeechAudioBufferRecognitionRequest()
    private var task: SFSpeechRecognitionTask?
    private var transcript = ""
    private var finished = false
    private var audioRunning = false
    private var silenceTimer: Timer?
    private let onPartial: (String) -> Void
    private let onFinished: (String?, String?) -> Void

    init(recognizer: SFSpeechRecognizer, onPartial: @escaping (String) -> Void, onFinished: @escaping (String?, String?) -> Void) {
        self.recognizer = recognizer
        self.onPartial = onPartial
        self.onFinished = onFinished
    }

    func start() {
        request.shouldReportPartialResults = true
        do {
            let audio = AVAudioSession.sharedInstance()
            try audio.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audio.setActive(true, options: .notifyOthersOnDeactivation)
            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            // No microphone (e.g. the simulator): installTap would crash on an empty format.
            guard format.sampleRate > 0, format.channelCount > 0 else {
                finish(nil, "unavailable")
                return
            }
            let request = self.request
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                request.append(buffer)
            }
            engine.prepare()
            try engine.start()
            audioRunning = true
        } catch {
            finish(nil, "unavailable")
            return
        }
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async { self?.handle(result: result, error: error) }
        }
        // Nothing said at all → stop like the web's one-shot recognition.
        armSilenceTimer(seconds: 8)
    }

    /// Ends the audio; the final transcript follows from the recognizer.
    func stop() {
        guard !finished else { return }
        silenceTimer?.invalidate()
        stopAudio()
        request.endAudio()
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
            guard let self, !self.finished else { return }
            self.finish(self.transcript, nil)
        }
    }

    /// Aborts without reporting anything.
    func cancel() {
        finished = true
        silenceTimer?.invalidate()
        stopAudio()
        task?.cancel()
    }

    private func handle(result: SFSpeechRecognitionResult?, error: Error?) {
        guard !finished else { return }
        if let result {
            transcript = result.bestTranscription.formattedString
            if result.isFinal {
                finish(transcript, nil)
                return
            }
            onPartial(transcript)
            // A pause after speaking ends the recording (Android's recognizer does the same).
            armSilenceTimer(seconds: 2.5)
        }
        if error != nil {
            finish(transcript, nil)
        }
    }

    private func armSilenceTimer(seconds: TimeInterval) {
        silenceTimer?.invalidate()
        silenceTimer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { [weak self] _ in
            self?.stop()
        }
    }

    private func stopAudio() {
        guard audioRunning else { return }
        audioRunning = false
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func finish(_ text: String?, _ error: String?) {
        guard !finished else { return }
        finished = true
        silenceTimer?.invalidate()
        stopAudio()
        task?.cancel()
        let trimmed = text?.trimmingCharacters(in: .whitespacesAndNewlines)
        onFinished((trimmed?.isEmpty ?? true) ? nil : trimmed, error)
    }
}
