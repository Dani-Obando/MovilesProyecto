import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  SlideInLeft,
  SlideInRight,
} from "react-native-reanimated";

export default function ResultScreen() {
  const { resumen, nombre } = useLocalSearchParams();
  const router = useRouter();

  const [resumenData, setResumenData] = useState(null);
  const [adivinanzas, setAdivinanzas] = useState({});
  const [resultadoAciertos, setResultadoAciertos] = useState(null);
  const [tituloFinal, setTituloFinal] = useState("");
  const [fraseFinal, setFraseFinal] = useState("");
  const [puntajeTotal, setPuntajeTotal] = useState(0);

  useEffect(() => {
    try {
      const parsed = JSON.parse(decodeURIComponent(resumen));
      setResumenData(parsed);
    } catch (err) {
      console.error("❌ Error al decodificar resumen:", err);
    }
  }, [resumen]);

  const esSobreviviente = resumenData?.sobrevivientes.includes(nombre);
  const misBloques = resumenData?.bloquesPorJugador[nombre] || [];

  const evaluarDesempeño = (aciertos, detalle) => {
    let puntos = 0;
  
    detalle.forEach(({ intento, pesoReal }) => {
      if (intento === pesoReal) puntos += 2;
      else if (Math.abs(intento - pesoReal) === 1) puntos += 1;
    });
  
    if (esSobreviviente) puntos += 2;
  
    if (resumenData?.totales.izquierdo === resumenData?.totales.derecho) {
      puntos += 3;
    }
  
    setPuntajeTotal(puntos);
  
    if (puntos >= 15) {
      setTituloFinal("🧠 Genio del equilibrio");
      setFraseFinal("Has dominado la precisión y el balance. ¡Asombroso!");
    } else if (puntos >= 10) {
      setTituloFinal("🥈 Gran Estratega");
      setFraseFinal("Buen ojo y gran sentido del peso.");
    } else if (puntos >= 6) {
      setTituloFinal("⚖️ Jugador Persistente");
      setFraseFinal("Sobreviviste con esfuerzo. No está nada mal.");
    } else if (puntos >= 1) {
      setTituloFinal("😅 Aprendiz");
      setFraseFinal("Necesitás mejorar tus sentidos...");
    } else {
      setTituloFinal("💀 Sin puntería");
      setFraseFinal("No adivinaste ni uno. ¿Estás jugando con los ojos cerrados?");
    }
  };
  

  const enviarAdivinanza = async () => {
    let aciertos = 0;
    const detalle = [];

    for (let i = 0; i < misBloques.length; i++) {
      const intento = parseInt(adivinanzas[i]);
      const pesoReal = misBloques[i].peso;
      const acertado = intento === pesoReal;
      if (acertado) aciertos++;
      detalle.push({ intento, pesoReal, acertado });
    }

    try {
      const response = await fetch("http://192.168.100.5:5000/adivinanzas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jugador: nombre,
          bloques: detalle,
          aciertos,
        }),
      });

      if (response.ok) {
        setResultadoAciertos(aciertos);
        evaluarDesempeño(aciertos, detalle);
      }
    } catch (error) {
      console.error("❌ Error al registrar adivinanza:", error.message);
    }
  };

  const volverAlInicio = () => {
    try {
      const socket = getSocket();
      if (socket && socket.readyState === 1) {
        socket.close(); // 🔒 cerrar para crear nueva conexión limpia
      }
    } catch (e) {
      console.log("Error al cerrar socket:", e.message);
    }
  
    setResumenData(null);
    setResultadoAciertos(null);
    setTituloFinal("");
    setFraseFinal("");
    setPuntajeTotal(0);
    setAdivinanzas({});
  
    router.replace("/");
  };
  
  

  if (!resumenData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.titulo}>Cargando resumen...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Animated.Text entering={FadeIn} style={styles.titulo}>🏁 Juego Finalizado</Animated.Text>

      <Animated.View entering={SlideInLeft.duration(400)} style={styles.datoBox}>
        <Text style={styles.linea}>⚖️ Izquierdo: {resumenData.totales.izquierdo}g</Text>
        <Text style={styles.linea}>⚖️ Derecho: {resumenData.totales.derecho}g</Text>
        <Text style={styles.linea}>
          👤 Sobrevivientes: {resumenData.sobrevivientes.join(", ") || "Ninguno"}
        </Text>
      </Animated.View>

      <Animated.Text entering={FadeInUp.delay(300)} style={styles.subtitulo}>📋 Jugadas:</Animated.Text>
      <Animated.View entering={SlideInRight.delay(400)} style={{ marginBottom: 20 }}>
        {resumenData.contenido.map((j, i) => (
          <Text key={i} style={styles.turno}>
            • Turno {j.turno}: {j.jugador} colocó {j.peso}g
          </Text>
        ))}
      </Animated.View>

      {esSobreviviente && resultadoAciertos === null && (
        <View style={styles.adivinanzaContainer}>
          <Text style={styles.subtitulo}>🎯 Adivina el peso de tus bloques</Text>
          {misBloques.map((bloque, i) => (
            <View key={i} style={{ marginBottom: 15 }}>
              <Text style={styles.bloqueLabel}>Bloque {i + 1} (color {bloque.color}):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[...Array(19)].map((_, n) => {
                  const valor = n + 2;
                  const seleccionado = adivinanzas[i] === valor;
                  return (
                    <TouchableOpacity
                      key={valor}
                      onPress={() =>
                        setAdivinanzas((prev) => ({ ...prev, [i]: valor }))
                      }
                      style={[
                        styles.opcion,
                        seleccionado && styles.opcionSeleccionada,
                      ]}
                    >
                      <Text style={{ color: seleccionado ? "white" : "#333" }}>{valor}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.boton, { backgroundColor: "#2ecc71" }]}
            onPress={enviarAdivinanza}
          >
            <Text style={styles.botonTexto}>✅ Enviar Adivinanza</Text>
          </TouchableOpacity>
        </View>
      )}

      {resultadoAciertos !== null && (
        <Animated.View entering={ZoomIn.duration(500)} style={styles.finalBox}>
          <Animated.Text entering={FadeIn.duration(800)} style={styles.medalla}>
            {tituloFinal}
          </Animated.Text>

          <Animated.Text entering={FadeInDown.delay(300)} style={styles.aciertos}>
            🎯 Acertaste {resultadoAciertos} de {misBloques.length} bloques
          </Animated.Text>

          <Animated.Text entering={FadeInDown.delay(500)} style={styles.puntaje}>
            🧠 Puntaje total: {puntajeTotal} puntos
          </Animated.Text>

          <Animated.Text entering={FadeInDown.delay(700)} style={styles.frase}>
            {fraseFinal}
          </Animated.Text>
        </Animated.View>
      )}

      <TouchableOpacity
        style={[styles.boton, { backgroundColor: "#3498db" }]}
        onPress={volverAlInicio}
      >
        <Text style={styles.botonTexto}>🔄 Volver al inicio</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#f9f9f9",
    paddingBottom: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  titulo: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  linea: {
    fontSize: 16,
    marginBottom: 4,
  },
  datoBox: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  subtitulo: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
  },
  turno: {
    fontSize: 14,
    marginLeft: 10,
    marginBottom: 3,
    color: "#555",
  },
  adivinanzaContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    elevation: 3,
  },
  bloqueLabel: {
    marginBottom: 5,
    fontWeight: "600",
  },
  opcion: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    marginRight: 6,
    backgroundColor: "#eee",
  },
  opcionSeleccionada: {
    backgroundColor: "#2ecc71",
    borderColor: "#27ae60",
  },
  boton: {
    marginTop: 25,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  botonTexto: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  finalBox: {
    marginTop: 30,
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    alignItems: "center",
  },
  medalla: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#e67e22",
  },
  aciertos: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#27ae60",
    marginBottom: 4,
  },
  puntaje: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2980b9",
    marginBottom: 6,
  },
  frase: {
    fontStyle: "italic",
    color: "#444",
    textAlign: "center",
  },
});
