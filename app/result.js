import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Alert,
} from "react-native";

export default function ResultScreen() {
    const { resumen, nombre } = useLocalSearchParams();
    const router = useRouter();

    const [resumenData, setResumenData] = useState(null);
    const [adivinanzas, setAdivinanzas] = useState({});
    const [resultadoAciertos, setResultadoAciertos] = useState(null);

    useEffect(() => {
        try {
            const parsed = JSON.parse(decodeURIComponent(resumen));
            setResumenData(parsed);
        } catch (err) {
            console.error("❌ Error al decodificar resumen:", err);
        }
    }, [resumen]);

    if (!resumenData) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.titulo}>Cargando resumen...</Text>
            </View>
        );
    }

    const esSobreviviente = resumenData.sobrevivientes.includes(nombre);
    const misBloques = resumenData.bloquesPorJugador[nombre] || [];

    const enviarAdivinanza = async () => {
        let aciertos = 0;
        const detalle = [];

        for (let i = 0; i < misBloques.length; i++) {
            const intento = parseInt(adivinanzas[i]);
            const real = misBloques[i].peso;

            if (isNaN(intento)) {
                Alert.alert("⚠️ Faltan respuestas", `Falta seleccionar el peso del bloque ${i + 1}`);
                return;
            }

            const acertado = intento === real;
            if (acertado) aciertos++;
            detalle.push({ intento, pesoReal: real, acertado });
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

            const data = await response.json();
            if (response.ok) {
                setResultadoAciertos(aciertos);
                Alert.alert("✅ Adivinanza enviada", `Adivinaste correctamente ${aciertos} de ${misBloques.length} bloques.`);
            } else {
                console.error("❌ Error backend:", data.error);
                Alert.alert("❌ Error al guardar", data.error || "Hubo un problema al guardar tu adivinanza.");
            }
        } catch (error) {
            console.error("❌ Error de red:", error.message);
            Alert.alert("❌ Error de red", error.message);
        }
    };

    return (
        <ScrollView style={{ padding: 20 }}>
            <Text style={styles.titulo}>🏁 Juego Finalizado</Text>
            <Text>⚖️ Izquierdo: {resumenData.totales.izquierdo}g</Text>
            <Text>⚖️ Derecho: {resumenData.totales.derecho}g</Text>
            <Text>🏆 Ganador: {resumenData.ganador}</Text>
            <Text>👤 Sobrevivientes: {resumenData.sobrevivientes.join(", ") || "Ninguno"}</Text>

            <Text style={styles.subtitulo}>📋 Jugadas:</Text>
            {resumenData.contenido.map((j, i) => (
                <Text key={i}>Turno {j.turno}: {j.jugador} colocó {j.peso}g</Text>
            ))}

            {esSobreviviente && resultadoAciertos === null && (
                <View style={{ marginTop: 30 }}>
                    <Text style={styles.subtitulo}>🎯 Adivina el peso de tus bloques</Text>
                    {misBloques.map((bloque, i) => (
                        <View key={i} style={{ marginBottom: 10 }}>
                            <Text>Bloque {i + 1} (color {bloque.color}):</Text>
                            <ScrollView horizontal>
                                {[...Array(19)].map((_, n) => {
                                    const valor = n + 2;
                                    return (
                                        <TouchableOpacity
                                            key={valor}
                                            onPress={() =>
                                                setAdivinanzas((prev) => ({
                                                    ...prev,
                                                    [i]: valor,
                                                }))
                                            }
                                            style={{
                                                padding: 6,
                                                margin: 2,
                                                borderWidth: 1,
                                                borderColor: "#999",
                                                backgroundColor:
                                                    adivinanzas[i] === valor ? "#add8e6" : "#f5f5f5",
                                                borderRadius: 4,
                                            }}
                                        >
                                            <Text>{valor}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    ))}

                    <TouchableOpacity
                        style={styles.boton}
                        onPress={enviarAdivinanza}
                    >
                        <Text style={styles.botonTexto}>✅ Enviar adivinanza</Text>
                    </TouchableOpacity>
                </View>
            )}

            {resultadoAciertos !== null && (
                <Text style={styles.aciertos}>
                    🎉 ¡Adivinaste correctamente {resultadoAciertos} de {misBloques.length} bloques!
                </Text>
            )}

            <TouchableOpacity
                onPress={() => router.replace("/")}
                style={[styles.boton, { backgroundColor: "#888" }]}
            >
                <Text style={styles.botonTexto}>🔄 Volver al inicio</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
    titulo: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
    subtitulo: { fontSize: 18, fontWeight: "bold", marginTop: 20, marginBottom: 10 },
    aciertos: { marginTop: 20, fontSize: 18, fontWeight: "bold", color: "green" },
    boton: {
        marginTop: 20,
        backgroundColor: "#2c3e50",
        padding: 10,
        borderRadius: 6,
        alignItems: "center",
    },
    botonTexto: { color: "white", fontWeight: "bold" },
});
