plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.copilot.remote"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.copilot.remote"
        minSdk = 26
        targetSdk = 35
        versionCode = 5
        versionName = "5.4.0"
    }

    signingConfigs {
        create("release") {
            storeFile = file("../release.keystore")
            storePassword = "aether123"
            keyAlias = "aether"
            keyPassword = "aether123"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    packagingOptions {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            pickFirst("META-INF/INDEX.LIST")
            pickFirst("META-INF/io.netty.versions.properties")
        }
    }
}

dependencies {
    // Compose BOM
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")

    // Compose
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    // WebSocket (OkHttp)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Socket.IO client
    implementation("io.socket:socket.io-client:2.1.1") {
        exclude(group = "org.jetbrains", module = "annotations-java5")
    }

    // NaCl encryption (Lazysodium for Android)
    implementation("net.java.dev.jna:jna:5.14.0@aar")
    implementation("com.goterl:lazysodium-android:5.1.0@aar")

    // JSON
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // Markdown rendering
    implementation("io.noties.markwon:core:4.6.2")
    implementation("io.noties.markwon:ext-tables:4.6.2")
    implementation("io.noties.markwon:syntax-highlight:4.6.2")

    // DataStore for preferences
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // Biometric authentication
    implementation("androidx.biometric:biometric:1.1.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
}

configurations.all {
    exclude(group = "org.jetbrains", module = "annotations-java5")
}
