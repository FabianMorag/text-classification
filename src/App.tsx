import { useTransition, useState, useEffect } from "react";
import {
  CreateMLCEngine,
  MLCEngine,
  type ChatCompletionMessageParam,
  type InitProgressReport,
} from "@mlc-ai/web-llm";

const initProgressCallback = (progress: InitProgressReport) => {
  console.log("Model loading progress:", progress);
};

const modelId = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

export default function App() {
  const [isLoading, startLoading] = useTransition();
  const [isAsking, startAsking] = useTransition();
  const [engine, setEngine] = useState<MLCEngine | null>(null);
  const [iaReply, setIaReply] = useState("");
  const [inputText, setInputText] = useState("");
  const [alert, setAlert] = useState(false);

  useEffect(() => {
    startLoading(async () => {
      const engine = await CreateMLCEngine(modelId, { initProgressCallback });
      setEngine(engine);
    });
  }, []);

  const classifyText = (text: string) => {
    startAsking(async () => {
      if (!text.trim()) return;

      const messages: Array<ChatCompletionMessageParam> = [
        {
          role: "system",
          content: `Eres un clasificador experto de texto tóxico en videojuegos. Analiza cuidadosamente cada texto.

          CATEGORÍAS CON EJEMPLOS CLAROS:

          "insulto_al_nickname": 
          - Burlas o ataques al nombre de usuario femenino
          - Ejemplos: "ese nombre de niña", "típico nick de mujer", "nombre ridículo"

          "insulto_por_rol_en_juego":
          - Ataques relacionados con roles específicos (support, healer, etc.)
          - Ejemplos: "eres una support inútil", "las mujeres solo juegan healer", "support de mierda"

          "insulto_asociado_a_un_esterotipo_domestico":
          - Referencias a tareas domésticas o estereotipos de género
          - Ejemplos: "vete a cocinar", "a lavar platos", "tu lugar está en la cocina"

          "prejuicios":
          - Suposiciones sobre habilidades en videojuegos por género
          - Ejemplos: "las mujeres no saben jugar", "eres mala porque eres mujer", "no sirves para esto"

          "lenguaje_ofensivo_o_amenaza":
          - Insultos directos, palabrotas o amenazas
          - Ejemplos: "perra", "zorra", "te voy a encontrar", lenguaje vulgar explícito

          "texto_neutral":
          - Cualquier texto que no encaje en las categorías anteriores
          - Incluye críticas constructivas, comunicación normal del juego

          INSTRUCCIONES PARA CONFIANZA:
          - 0.9-1.0: Muy claro, obviamente pertenece a la categoría
          - 0.7-0.8: Probable, encaja bien en la categoría
          - 0.5-0.6: Posible, pero no completamente claro
          - 0.3-0.4: Dudoso, podría ser otra categoría
          - 0.1-0.2: Muy incierto, probablemente neutral

          IMPORTANTE: Si tienes dudas, es mejor asignar "texto_neutral" con baja confianza.

          
          `,
        },
        // EJEMPLOS DE CLASIFICACIÓN:

        // Texto: "vete a la cocina"
        // Respuesta: {"categoria": "insulto_asociado_a_un_esterotipo_domestico", "confianza": 0.95}

        // Texto: "eres mala jugando"
        // Respuesta: {"categoria": "prejuicios", "confianza": 0.8}

        // Texto: "buen juego, gracias por el heal"
        // Respuesta: {"categoria": "texto_neutral", "confianza": 0.9}
        {
          role: "user",
          content: `Clasifica este texto: "${text}"`,
        },
      ];

      const reply = await engine?.chat.completions.create({
        messages,
        stream: false,
        response_format: {
          type: "json_object",
          schema: JSON.stringify({
            type: "object",
            properties: {
              categoria: {
                type: "string",
                enum: [
                  "insulto_al_nickname",
                  "insulto_por_rol_en_juego",
                  "insulto_asociado_a_un_esterotipo_domestico",
                  "prejuicios",
                  "lenguaje_ofensivo_o_amenaza",
                  "texto_neutral",
                ],
              },
              confianza: {
                type: "number",
              },
            },
            required: ["categoria", "confianza"],
            additionalProperties: false,
          }),
        },
        temperature: 0.8,
        max_tokens: 150,
      });

      const content = reply?.choices[0].message.content;
      console.log("Respuesta completa:", reply?.choices[0].message.content);

      if (content) {
        try {
          const jsonResponse = JSON.parse(content);
          if (
            typeof jsonResponse === "object" &&
            !Array.isArray(jsonResponse) &&
            typeof jsonResponse.categoria === "string" &&
            typeof jsonResponse.confianza === "number"
          ) {
            setAlert(jsonResponse.confianza > 0.5);
            const response = JSON.stringify(jsonResponse, null, 4);
            setIaReply(response);
          } else {
            console.error("Formato inválido:", jsonResponse);
            setIaReply(
              "El modelo no retornó el formato JSON correcto. Respuesta: " +
                content
            );
          }
        } catch (error) {
          console.error("Error al parsear JSON:", error);
          setIaReply(
            "Error al parsear la respuesta del modelo. Respuesta cruda: " +
              content
          );
        }
      } else {
        setIaReply("No se recibió respuesta del modelo.");
      }
    });
  };

  return (
    <main className="flex flex-col justify-center items-center bg-slate-950 p-8 w-screen h-screen">
      <div className="space-y-6 w-full max-w-2xl">
        <h1 className="mb-8 font-bold text-slate-50 text-4xl text-center">
          Clasificador de insultos
        </h1>

        <div className="space-y-4">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.currentTarget.value)}
            placeholder="Escribe el texto que quieres clasificar..."
            className="bg-slate-800 p-4 border border-slate-600 rounded-lg w-full text-slate-50"
            rows={3}
          />

          <button
            onClick={() => classifyText(inputText)}
            disabled={isLoading || isAsking || !inputText.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 p-3 rounded-lg w-full font-semibold text-white hover:cursor-pointer"
          >
            {isLoading
              ? "Cargando modelo..."
              : isAsking
              ? "Esperando Respuesta..."
              : "Clasificar Texto"}
          </button>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg">
          <h2 className="mb-3 font-semibold text-slate-300 text-lg">
            Resultado:
          </h2>
          {isAsking && <p className="text-slate-400">Analizando texto...</p>}
          {!(isLoading || isAsking) && iaReply && (
            <pre className="bg-slate-900 p-4 rounded overflow-auto text-slate-50 text-sm">
              {iaReply}
            </pre>
          )}
          {!(isLoading || isAsking) && alert && (
            <small className="text-red-500">POTENCIAL AGRESIÓN</small>
          )}
        </div>
      </div>
    </main>
  );
}
