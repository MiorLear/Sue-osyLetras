# --- dev target: hot-reload friendly, used by docker-compose.yml ---
# Uses the image's built-in `mvn` (not the wrapper) — this always runs inside
# Docker, so there's no "Maven not installed on the host" problem to solve
# here. The wrapper (./mvnw) is still committed for anyone who wants to run
# the API directly on a machine with Java 21 but no Maven — see api/README.md.
FROM maven:3.9-eclipse-temurin-21 AS dev
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src src
EXPOSE 8000
CMD ["mvn", "-q", "spring-boot:run"]

# --- build stage: compiles a runnable jar ---
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src src
RUN mvn -B -q package -DskipTests

# --- prod target: small runtime image ---
FROM eclipse-temurin:21-jre AS prod
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8000
ENTRYPOINT ["java", "-jar", "app.jar"]
