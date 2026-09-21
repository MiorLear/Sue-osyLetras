-- El contenido de "Aprendiendo sobre bienestar emocional", del documento de
-- Sueños y Letras.
--
-- Lo que había en los tres temas era un resumen: un párrafo por subtema, que es
-- todo lo que cabía en la columna `body`. El material real trae para cada tema
-- su propia introducción, secciones "¿Por qué es importante?", listas de
-- prácticas, cuadros de "Recuerda" y preguntas para reflexionar.
--
-- Generado desde shared/src/api/mock/seed.ts con scripts/gen-learning-content.mjs
-- para que la copia del mock y esta no puedan divergir a mano. Si hay que
-- corregir una frase, el sitio es el CMS: esta migración ya corrió.
--
-- INSERT ... ON CONFLICT y no UPDATE, porque Flyway corre ANTES que el contexto
-- de Spring: en una base recién creada esta migración llega con topics vacía, y
-- un UPDATE tocaría cero filas. Con el upsert, una base nueva y la de
-- producción acaban en el mismo sitio.


INSERT INTO topics (id, emoji, title, layout, intro) VALUES
    ('autocuidado', '🧘', 'Practicar autocuidado', 'PATH',
     '[{"kind":"paragraph","text":"Antes de cuidar a otros, también necesitamos aprender a cuidarnos."},{"kind":"paragraph","text":"El autocuidado no consiste únicamente en descansar o relajarse. Es un conjunto de acciones cotidianas que fortalecen nuestro bienestar físico, emocional y mental."},{"kind":"paragraph","text":"Cuando una docente cuida de sí misma, también fortalece su capacidad para acompañar a sus estudiantes con mayor calma, empatía y presencia."}]'::jsonb),
    ('salud-mental', '🧠', '¿Por qué importa la salud mental en la infancia?', 'SLIDES',
     '[{"kind":"paragraph","text":"La infancia y la adolescencia son etapas fundamentales para el desarrollo emocional, social y cognitivo."},{"kind":"paragraph","text":"Las experiencias que viven niñas, niños y adolescentes influyen en la manera en que comprenden el mundo, construyen relaciones y enfrentan los desafíos de la vida."},{"kind":"paragraph","text":"Promover la salud mental no significa esperar a que aparezcan dificultades. Significa crear entornos donde todas las personas puedan sentirse seguras, escuchadas, respetadas y acompañadas."}]'::jsonb),
    ('aula', '🏫', 'Cómo acompañar emociones difíciles en el aula', 'SLIDES',
     '[{"kind":"paragraph","text":"Las emociones difíciles forman parte de la vida escolar."},{"kind":"paragraph","text":"Como docentes, no siempre podremos resolver aquello que viven nuestros estudiantes, pero sí podemos ofrecer un espacio seguro donde se sientan escuchados, comprendidos y acompañados."},{"kind":"paragraph","text":"Muchas veces, lo que más necesita una niña, niño o adolescente no es una respuesta inmediata, sino la certeza de que no está enfrentando esa emoción en soledad."}]'::jsonb)
ON CONFLICT (id) DO UPDATE
   SET emoji  = EXCLUDED.emoji,
       title  = EXCLUDED.title,
       layout = EXCLUDED.layout,
       intro  = EXCLUDED.intro;

-- Los pdfs/videos/audios que una administradora ya subió a una fase NO los
-- escribe esta migración y no se pueden perder: son archivos reales en Cloud
-- Storage cuyo único puntero es esta fila. Se guardan por clave y se vuelven a
-- colgar de la fase que tenga esa misma clave.
CREATE TEMP TABLE medios_previos ON COMMIT DROP AS
SELECT topic_id,
       -- Dos fases de `aula` se reorganizaron y con ello cambiaron de clave.
       -- Sin este puente, los archivos que colgaran de ellas quedarían
       -- huérfanos. Las claves viejas se derivan con explorarte_slug() de los
       -- títulos que sembraba DataSeeder, no se escriben a mano: así el
       -- truncado a 48 caracteres es el mismo que aplicó V12.
       CASE subtopic_key
           WHEN explorarte_slug('Qué hacer y qué evitar cuando un estudiante expresa emociones')
                THEN 'que-hacer-cuando-expresa-una-emocion-dificil'
           WHEN explorarte_slug('Recomendaciones para promover espacios seguros y respetuosos')
                THEN 'construyendo-espacios-emocionalmente-seguros'
           ELSE subtopic_key
       END AS subtopic_key,
       pdfs, videos, audios
  FROM topic_subtopics
 WHERE topic_id IN ('autocuidado', 'salud-mental', 'aula');

DELETE FROM topic_subtopics
 WHERE topic_id IN ('autocuidado', 'salud-mental', 'aula');

-- Sin id explícito: dejar que la secuencia BIGSERIAL los asigne es lo único
-- que funciona igual en una base vacía y en una donde ya hay subtemas.
INSERT INTO topic_subtopics
    (topic_id, position, subtopic_key, emoji, title, blocks, pdfs, videos, audios)
SELECT v.topic_id, v.position, v.subtopic_key, v.emoji, v.title, v.blocks,
       COALESCE(m.pdfs,   '[]'::jsonb),
       COALESCE(m.videos, '[]'::jsonb),
       COALESCE(m.audios, '[]'::jsonb)
  FROM (VALUES
        ('autocuidado', 0, 'cuidando-mis-emociones', '🌸', 'Cuidando mis emociones',
         '[{"kind":"heading","text":"¿Por qué es importante?"},{"kind":"paragraph","text":"Las emociones forman parte de nuestra vida diaria. Reconocerlas, nombrarlas y comprenderlas nos permite responder de manera más consciente a los desafíos que enfrentamos."},{"kind":"paragraph","text":"El autocuidado emocional implica escuchar lo que sentimos sin juzgarnos y desarrollar estrategias saludables para expresar nuestras emociones."},{"kind":"paragraph","text":"No se trata de evitar emociones difíciles, sino de aprender a convivir con ellas."},{"kind":"checklist","title":"Algunas prácticas que pueden ayudarte","items":["Preguntarte diariamente: «¿Cómo me siento hoy?»","Identificar qué situaciones generan bienestar o malestar.","Hablar con alguien de confianza.","Escribir lo que sientes.","Permitirte descansar cuando lo necesitas.","Reconocer tus logros, incluso los pequeños."]},{"kind":"callout","title":"Recuerda","text":"Todas las emociones son válidas. Lo importante no es dejar de sentirlas, sino aprender a comprender lo que quieren comunicarnos."},{"kind":"reflection","questions":["¿Qué emoción ha estado más presente en mí durante esta semana?","¿Qué necesito para cuidar mejor de mi bienestar emocional?"]}]'::jsonb),
        ('autocuidado', 1, 'cuidando-mi-cuerpo', '🌿', 'Cuidando mi cuerpo',
         '[{"kind":"heading","text":"¿Por qué es importante?"},{"kind":"paragraph","text":"Nuestro cuerpo y nuestras emociones están profundamente conectados."},{"kind":"paragraph","text":"Dormir poco, alimentarnos de manera inadecuada o vivir bajo estrés constante puede afectar nuestro bienestar emocional."},{"kind":"paragraph","text":"De la misma manera, cuando cuidamos nuestro cuerpo también fortalecemos nuestra salud mental."},{"kind":"checklist","title":"Algunas prácticas que pueden ayudarte","items":["Dormir las horas necesarias.","Mantener una alimentación variada.","Mantenerte hidratado.","Realizar actividad física regularmente.","Tomar pausas durante la jornada.","Respirar profundamente varias veces al día.","Escuchar las señales de cansancio de tu cuerpo."]},{"kind":"callout","title":"Recuerda","text":"Cuidar tu cuerpo también es una forma de cuidar tus emociones."},{"kind":"reflection","questions":["¿Qué necesita hoy mi cuerpo?","¿Qué pequeño hábito puedo fortalecer esta semana?"]}]'::jsonb),
        ('autocuidado', 2, 'cuidando-mi-mente', '🧠', 'Cuidando mi mente',
         '[{"kind":"heading","text":"¿Por qué es importante?"},{"kind":"paragraph","text":"Nuestra mente necesita espacios para descansar, aprender y recuperar energía."},{"kind":"paragraph","text":"Vivimos rodeados de estímulos constantes. Por eso, es importante crear momentos que favorezcan la concentración, la creatividad y el equilibrio emocional."},{"kind":"checklist","title":"Algunas prácticas que pueden ayudarte","items":["Leer por placer.","Respirar conscientemente.","Reducir el tiempo frente a pantallas.","Practicar ejercicios de atención plena.","Dedicar tiempo a actividades que disfrutes.","Aprender algo nuevo.","Recordar que no necesitamos hacerlo todo perfectamente."]},{"kind":"callout","title":"Recuerda","text":"Descansar también es parte del aprendizaje."},{"kind":"reflection","questions":["¿Qué actividades ayudan a que mi mente descanse?","¿Qué pensamientos me gustaría aprender a soltar?"]}]'::jsonb),
        ('salud-mental', 0, 'que-favorece-el-bienestar-emocional', '🌤️', '¿Qué favorece el bienestar emocional?',
         '[{"kind":"paragraph","text":"Los estudios muestran que niñas, niños y adolescentes desarrollan mayor bienestar cuando cuentan con:"},{"kind":"checklist","title":"Lo que sostiene el bienestar","items":["Relaciones afectivas seguras.","Personas adultas que escuchan sin juzgar.","Espacios donde puedan expresar lo que sienten.","Rutinas estables.","Oportunidades para jugar, crear y participar.","Sentido de pertenencia dentro de la comunidad educativa."]}]'::jsonb),
        ('salud-mental', 1, 'el-papel-de-la-escuela', '🏫', '¿Cuál es el papel de la escuela?',
         '[{"kind":"paragraph","text":"La escuela es uno de los espacios donde niñas, niños y adolescentes pasan gran parte de su tiempo."},{"kind":"paragraph","text":"Las docentes no reemplazan a profesionales de la salud mental, pero sí pueden convertirse en figuras significativas que promuevan ambientes protectores y favorezcan el desarrollo socioemocional."},{"kind":"paragraph","text":"Pequeñas acciones, como escuchar con atención, validar emociones o generar espacios de diálogo, pueden marcar una diferencia importante."}]'::jsonb),
        ('salud-mental', 2, 'que-son-las-emociones', '💛', '¿Qué son las emociones?',
         '[{"kind":"paragraph","text":"Las emociones son respuestas naturales que aparecen ante diferentes situaciones de nuestra vida."},{"kind":"paragraph","text":"Nos ayudan a comprender lo que vivimos, tomar decisiones, protegernos y relacionarnos con otras personas."},{"kind":"paragraph","text":"Todas las personas experimentamos emociones. No existen emociones buenas o malas; cada una cumple una función importante."},{"kind":"paragraph","text":"Reconocerlas y expresarlas de manera saludable fortalece nuestro bienestar y nuestras relaciones."}]'::jsonb),
        ('salud-mental', 3, 'todas-las-emociones-tienen-una-funcion', '🧭', 'Todas las emociones tienen una función',
         '[{"kind":"paragraph","text":"Cada emoción nos envía un mensaje."},{"kind":"definitions","title":"El mensaje de cada emoción","items":[{"term":"La alegría","text":"nos invita a compartir aquello que disfrutamos."},{"term":"La tristeza","text":"nos ayuda a reconocer pérdidas y buscar apoyo."},{"term":"El miedo","text":"nos protege frente al peligro."},{"term":"El enojo","text":"nos muestra que algo nos incomoda o que nuestros límites han sido vulnerados."},{"term":"La frustración","text":"aparece cuando algo no resulta como esperábamos y nos invita a buscar nuevas estrategias."},{"term":"La vergüenza","text":"nos ayuda a reflexionar sobre nuestras acciones, aunque cuando aparece de forma intensa puede afectar nuestra autoestima."},{"term":"La ansiedad","text":"prepara a nuestro cuerpo para responder ante situaciones desafiantes, aunque cuando permanece durante mucho tiempo puede generar malestar."}]},{"kind":"paragraph","text":"Comprender el propósito de cada emoción nos ayuda a responder con mayor empatía hacia nosotros mismos y hacia los demás."}]'::jsonb),
        ('aula', 0, 'estrategias-practicas-para-docentes', '🤝', 'Estrategias prácticas para docentes',
         '[{"kind":"heading","text":"Escucha antes de intervenir"},{"kind":"paragraph","text":"Permite que el estudiante exprese lo que siente antes de ofrecer soluciones o consejos."},{"kind":"heading","text":"Valida la emoción"},{"kind":"paragraph","text":"Puedes decir:"},{"kind":"quote","text":"Entiendo que esto ha sido difícil para ti."},{"kind":"quote","text":"Gracias por contarme cómo te sientes."},{"kind":"paragraph","text":"Validar no significa estar de acuerdo con una conducta, sino reconocer la experiencia emocional de la persona."},{"kind":"heading","text":"Ayuda a poner nombre a la emoción"},{"kind":"paragraph","text":"Muchas veces las niñas y los niños sienten algo, pero no saben cómo expresarlo. Preguntas como:"},{"kind":"quote","text":"¿Cómo describirías lo que estás sintiendo?"},{"kind":"quote","text":"¿Qué crees que necesita esa emoción?"},{"kind":"paragraph","text":"pueden ayudarles a comprender mejor su experiencia."},{"kind":"heading","text":"Mantén la calma"},{"kind":"paragraph","text":"Las emociones son contagiosas."},{"kind":"paragraph","text":"Cuando una persona adulta responde con serenidad, transmite seguridad al grupo."},{"kind":"heading","text":"Ofrece alternativas"},{"kind":"paragraph","text":"En lugar de decir únicamente «cálmate», puedes preguntar:"},{"kind":"quote","text":"¿Qué podría ayudarte en este momento?"},{"kind":"quote","text":"¿Prefieres respirar un momento, dibujar o conversar?"}]'::jsonb),
        ('aula', 1, 'que-hacer-cuando-expresa-una-emocion-dificil', '✅', 'Qué hacer cuando un estudiante expresa una emoción difícil',
         '[{"kind":"checklist","title":"Qué hacer","items":["Escuchar con atención.","Agradecer la confianza.","Hablar en un lugar tranquilo cuando sea posible.","Validar la emoción.","Respetar los silencios.","Observar cambios persistentes en el comportamiento.","Buscar apoyo dentro de la institución cuando sea necesario."]}]'::jsonb),
        ('aula', 2, 'que-evitar', '⚠️', 'Qué evitar',
         '[{"kind":"avoidlist","title":"Qué evitar","items":["Minimizar lo que siente: «No es para tanto».","Comparar su experiencia: «Hay personas que están peor».","Obligarle a hablar.","Ridiculizar o bromear sobre lo que expresa.","Prometer confidencialidad absoluta cuando la seguridad del estudiante pueda estar en riesgo."]}]'::jsonb),
        ('aula', 3, 'construyendo-espacios-emocionalmente-seguros', '🌱', 'Construyendo espacios emocionalmente seguros',
         '[{"kind":"paragraph","text":"Las comunidades educativas que promueven el bienestar emocional suelen compartir algunas características:"},{"kind":"checklist","title":"Lo que tienen en común","items":["Escuchan con respeto.","Reconocen la diversidad de experiencias.","Promueven la participación.","Valoran el error como parte del aprendizaje.","Favorecen relaciones basadas en la empatía y el cuidado mutuo."]},{"kind":"reflection","questions":["Una conversación respetuosa puede convertirse en el primer paso para que una niña, un niño o un adolescente se sienta acompañado. ¿Qué conversación pendiente tengo con alguno de mis estudiantes?"]}]'::jsonb)
       ) AS v(topic_id, position, subtopic_key, emoji, title, blocks)
  LEFT JOIN medios_previos m
         ON m.topic_id = v.topic_id AND m.subtopic_key = v.subtopic_key;

-- Los párrafos de introducción de la pantalla de aprendizaje. El video sigue
-- vacío: ese archivo no existe todavía y se sube desde el CMS.
--
-- Solo se escriben si la fila no tiene ya texto propio: si alguien se adelantó
-- y los escribió desde el CMS, lo suyo manda.
INSERT INTO screen_intro_videos (screen_key, video, paragraphs) VALUES
    ('learning', NULL, '["Acompañar el bienestar emocional también implica seguir aprendiendo.","Esta sección busca fortalecer los conocimientos y herramientas de las docentes para acompañar procesos de bienestar emocional en sus comunidades educativas.","En esta sección encontrarás contenidos breves que te ayudarán a comprender mejor las emociones, fortalecer tu práctica educativa y construir espacios de aprendizaje más seguros, empáticos y respetuosos."]'::jsonb)
ON CONFLICT (screen_key) DO UPDATE
   SET paragraphs = EXCLUDED.paragraphs
 WHERE jsonb_array_length(screen_intro_videos.paragraphs) = 0;
