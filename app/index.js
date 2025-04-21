import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function InicioScreen() {
  const [nombre, setNombre] = useState("");
  const [modo, setModo] = useState("individual"); // o "multijugador"
  const router = useRouter();

  useEffect(() => {
    // Recuperar nombre guardado al volver a la pantalla
    AsyncStorage.getItem("nombreJugador").then((guardado) => {
      if (guardado) setNombre(guardado);
    });
  }, []);

  const iniciar = async () => {
    if (!nombre.trim()) {
      Alert.alert("⚠️ Escribe un nombre para jugar");
      return;
    }

    // Guardar nombre en almacenamiento local
    await AsyncStorage.setItem("nombreJugador", nombre.trim());

    router.push({
      pathname: "/game",
      params: {
        nombre: nombre.trim(),
        modo,
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>🎮 Juego de la Balanza</Text>

      <TextInput
        style={styles.input}
        placeholder="Tu nombre"
        value={nombre}
        onChangeText={setNombre}
      />

      <Text style={styles.subtitulo}>Selecciona modo de juego:</Text>
      <View style={styles.botonesModo}>
        <TouchableOpacity
          style={[styles.botonModo, modo === "individual" && styles.activo]}
          onPress={() => setModo("individual")}
        >
          <Text style={styles.textoBoton}>Individual</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.botonModo, modo === "multijugador" && styles.activo]}
          onPress={() => setModo("multijugador")}
        >
          <Text style={styles.textoBoton}>Multijugador</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.botonJugar} onPress={iniciar}>
        <Text style={styles.botonTexto}>🚀 Empezar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f2f2f2" },
  titulo: { fontSize: 28, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  subtitulo: { fontSize: 16, fontWeight: "600", marginTop: 20 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  botonesModo: { flexDirection: "row", justifyContent: "space-around", marginTop: 10 },
  botonModo: {
    padding: 10,
    backgroundColor: "#ddd",
    borderRadius: 6,
    width: "40%",
    alignItems: "center",
  },
  activo: {
    backgroundColor: "#3498db",
  },
  textoBoton: {
    color: "white",
    fontWeight: "bold",
  },
  botonJugar: {
    marginTop: 40,
    backgroundColor: "#2ecc71",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  botonTexto: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});
