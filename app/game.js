import { useLocalSearchParams, useRouter } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Animated,
  PanResponder,
} from "react-native";
import { useEffect, useState, useRef } from "react";
import { getSocket } from "../sockets/connection";
import BalanzaAnimada from "../components/BalanzaAnimada";

const COLORES = ["red", "blue", "green", "orange", "purple"];

export default function GameScreen() {
  const { nombre, modo } = useLocalSearchParams();
  const router = useRouter();
  const socket = getSocket();

  const [bloques, setBloques] = useState([]);
  const [pesoIzq, setPesoIzq] = useState(0);
  const [pesoDer, setPesoDer] = useState(0);
  const [bloquesIzq, setBloquesIzq] = useState([]);
  const [bloquesDer, setBloquesDer] = useState([]);
  const [miTurno, setMiTurno] = useState(false);
  const [jugadorEnTurno, setJugadorEnTurno] = useState("");
  const [eliminado, setEliminado] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [contador, setContador] = useState(60);
  const [jugadoresConectados, setJugadoresConectados] = useState(1);
  const [esperando, setEsperando] = useState(modo === "multijugador");
  const [equipos, setEquipos] = useState([]);
  const [tiempoRestante, setTiempoRestante] = useState(null);

  const [dropAreas, setDropAreas] = useState({ izquierdo: null, derecho: null });
  const intervaloRef = useRef(null);

  useEffect(() => {
    const nuevos = [];
    COLORES.forEach((color) => {
      for (let i = 0; i < 2; i++) {
        nuevos.push({
          id: `${color}-${i}-${Math.random().toString(36).substring(7)}`,
          color,
          peso: Math.floor(Math.random() * 19) + 2,
          usado: false,
          pan: new Animated.ValueXY(),
        });
      }
    });
    setBloques(nuevos);
  }, []);

  useEffect(() => {
    const mensaje = { type: "ENTRADA", jugador: nombre, modo };
    if (socket.readyState === 1) socket.send(JSON.stringify(mensaje));
    else socket.onopen = () => socket.send(JSON.stringify(mensaje));

    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === "TURNO") {
          setMiTurno(data.tuTurno);
          setJugadorEnTurno(data.jugadorEnTurno);
          if (data.tuTurno) {
            setContador(60);
            clearInterval(intervaloRef.current);
            intervaloRef.current = setInterval(() => {
              setContador((prev) => {
                if (prev <= 1) {
                  clearInterval(intervaloRef.current);
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
          }
        }

        if (data.type === "ACTUALIZAR_BALANZA") {
          setPesoIzq(data.izquierdo);
          setPesoDer(data.derecho);
        }

        if (data.type === "MENSAJE") {
          setMensajes((prev) => [...prev, data.contenido]);
        }

        if (data.type === "ELIMINADO") {
          setEliminado(true);
          setMiTurno(false);
          Alert.alert("🚫 Eliminado", data.mensaje);
        }

        if (data.type === "RESUMEN") {
          clearInterval(intervaloRef.current);
          router.replace({
            pathname: "/result",
            params: {
              resumen: encodeURIComponent(JSON.stringify(data)),
              nombre,
            },
          });
        }

        if (data.type === "ENTRADA" && data.totalJugadores !== undefined) {
          setJugadoresConectados(data.totalJugadores);
        }

        if (data.type === "TEMPORIZADOR") {
          setTiempoRestante(data.tiempoRestante);
        }

        if (data.type === "EQUIPOS") {
          setEquipos(data.lista);
        }
      } catch (err) {
        console.error("❌ WS Error:", err.message);
      }
    };

    return () => {
      clearInterval(intervaloRef.current);
    };
  }, []);

  const enviarJugada = (bloque, lado) => {
    socket.send(JSON.stringify({
      type: "JUGADA",
      jugador: nombre,
      peso: bloque.peso,
      color: bloque.color,
      lado,
    }));

    setBloques((prev) =>
      prev.map((b) => (b.id === bloque.id ? { ...b, usado: true } : b))
    );

    if (lado === "izquierdo") setBloquesIzq((prev) => [...prev, bloque]);
    if (lado === "derecho") setBloquesDer((prev) => [...prev, bloque]);

    setMiTurno(false);
  };

  const isInDropArea = (gesture, area) => {
    if (!area) return false;
    const { moveX, moveY } = gesture;
    return (
      moveX > area.x &&
      moveX < area.x + area.width &&
      moveY > area.y &&
      moveY < area.y + area.height
    );
  };

  const renderBloque = (bloque) => {
    if (bloque.usado) return null;

    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => miTurno && !eliminado,
      onPanResponderGrant: () => bloque.pan.extractOffset(),
      onPanResponderMove: Animated.event(
        [null, { dx: bloque.pan.x, dy: bloque.pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gesture) => {
        bloque.pan.flattenOffset();
        const inIzq = isInDropArea(gesture, dropAreas.izquierdo);
        const inDer = isInDropArea(gesture, dropAreas.derecho);

        if (inIzq) {
          enviarJugada(bloque, "izquierdo");
        } else if (inDer) {
          enviarJugada(bloque, "derecho");
        } else {
          Animated.spring(bloque.pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    });

    return (
      <Animated.View
        key={bloque.id}
        {...panResponder.panHandlers}
        style={[
          styles.bloque,
          { backgroundColor: bloque.color },
          {
            transform: [
              { translateX: bloque.pan.x },
              { translateY: bloque.pan.y },
            ],
          },
        ]}
      />
    );
  };

  const MAX_JUGADORES = 4;

  if (modo === "multijugador" && esperando) {
    return (
      <View style={styles.centered}>
        <Text style={styles.titulo}>⏳ Esperando jugadores...</Text>
        <Text style={styles.subtitulo}>
          {jugadoresConectados < MAX_JUGADORES
            ? `Faltan ${MAX_JUGADORES - jugadoresConectados} jugador(es)`
            : "Jugadores completos"}
        </Text>

        {tiempoRestante !== null && (
          <Text style={styles.timer}>🕒 Iniciando en: {tiempoRestante}s</Text>
        )}

        <Text style={styles.subtitulo}>👥 Equipos actuales:</Text>
        {equipos.map((equipo, i) => (
          <Text key={i} style={styles.equipo}>
            Equipo {i + 1}: {equipo.join(" y ")}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={styles.titulo}>Jugador: {nombre}</Text>
      <Text style={styles.subtitulo}>Turno de: {jugadorEnTurno || "..."}</Text>
      <Text style={{ color: "red", marginBottom: 10 }}>
        {miTurno ? `⏱️ Tiempo: ${contador}s` : "⏳ Esperando turno..."}
      </Text>

      <BalanzaAnimada
        pesoIzq={pesoIzq}
        pesoDer={pesoDer}
        bloquesIzq={bloquesIzq}
        bloquesDer={bloquesDer}
        setDropAreas={setDropAreas}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 30 }}>
        {bloques.map(renderBloque)}
      </View>

      <Text style={{ marginTop: 30, fontWeight: "bold" }}>📨 Mensajes:</Text>
      <ScrollView style={{ marginTop: 10, maxHeight: 200 }}>
        {mensajes.map((msg, idx) => (
          <Text key={idx} style={{ marginBottom: 5 }}>{msg}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: 18, marginBottom: 10 },
  subtitulo: { fontSize: 16, fontWeight: "bold", marginBottom: 10 },
  timer: { fontSize: 20, color: "tomato", marginTop: 10 },
  bloque: {
    width: 60,
    height: 60,
    borderRadius: 8,
    margin: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 2, height: 2 },
    shadowRadius: 3,
  },
  esperando: { fontSize: 18, textAlign: "center" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  equipo: { fontSize: 15, marginVertical: 3 },
});
