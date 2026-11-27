// swift-tools-version: 6.0
import PackageDescription
let package = Package(
    name: "MundaNative", platforms: [.iOS(.v15)],
    products: [.library(name: "MundaNative", targets: ["MundaNative"])],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.6.3"),
        .package(url: "https://github.com/firebase/firebase-ios-sdk.git", exact: "12.19.3")
    ],
    targets: [.target(name: "MundaNative", dependencies: [
        .product(name: "Capacitor", package: "capacitor-swift-pm"),
        .product(name: "FirebaseAILogic", package: "firebase-ios-sdk"),
        .product(name: "FirebaseAppCheck", package: "firebase-ios-sdk")
    ], swiftSettings: [.swiftLanguageMode(.v5)])]
)
