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
# GCP-07: la suite arranca un PostgreSQL real para validar la cadena de
# migraciones (MigrationChainTest), y initdb se niega a correr como root. La
# imagen de Maven corre como root, asi que el build se hace con un usuario
# normal. Tiene que crearse ANTES de poblar el cache de Maven, o las
# dependencias quedan en /root/.m2 y este usuario no las ve.
RUN useradd --create-home --uid 1001 builder
WORKDIR /app
RUN chown builder:builder /app
USER builder
COPY --chown=builder:builder pom.xml .
RUN mvn -B -q dependency:go-offline
COPY --chown=builder:builder src src
# Sin -DskipTests: la imagen que se despliega no se construye si los tests estan
# en rojo (MAINT-02). La suite no toca red ni ningun servicio externo — el
# Postgres de MigrationChainTest es un binario embebido, no un contenedor — asi
# que corre igual dentro del build de Docker.
RUN mvn -B -q package

# --- prod target: small runtime image ---
FROM eclipse-temurin:21-jre AS prod
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8000
ENTRYPOINT ["java", "-jar", "app.jar"]
