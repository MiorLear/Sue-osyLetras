package com.explorarte.api.config;

import java.io.IOException;
import java.util.Date;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;

/** Uses Application Default Credentials on Cloud Run; no service-account key is stored. */
@Configuration
public class FirebaseConfig {

    @Bean
    FirebaseAuth firebaseAuth() {
        FirebaseApp app = FirebaseApp.getApps().stream().findFirst()
                .orElseGet(() -> FirebaseApp.initializeApp(
                        FirebaseOptions.builder()
                                .setProjectId("explorarte-6335b")
                                .setCredentials(applicationDefaultCredentials())
                                .build()));
        return FirebaseAuth.getInstance(app);
    }

    private static GoogleCredentials applicationDefaultCredentials() {
        try {
            return GoogleCredentials.getApplicationDefault();
        } catch (IOException ignored) {
            // Keeps local/tests bootable. Token verification still fails closed because
            // revocation checking needs authenticated Firebase access.
            return GoogleCredentials.create(new AccessToken("local-no-credentials", new Date(0)));
        }
    }
}
