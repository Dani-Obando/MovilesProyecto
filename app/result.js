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
import socket from "../sockets/connection"; // Asegúrate que esta ruta sea la correcta

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

    const esSobreviviente = resumenData?.sobrevivientes.includes(nombre);
    const misBloques = resumenData?.bloquesPorJugador[nombre] || [];

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
                Alert.alert("✅ Adivinanza enviada", `Adivinaste ${aciertos} de ${misBloques.length}`);
            } else {
                const data = await response.json();
                Alert.alert("❌ Error", data?.error || "No se pudo guardar la adivinanza");
            }
        } catch (error) {
            console.error("❌ Error al registrar adivinanza:", error.message);
            Alert.alert("❌ Error de red", "No se pudo enviar la adivinanza.");
        }
    };

    const volverAlInicio = () => {
        try {
            if (socket && socket.readyState === 1) {
                socket.send(JSON.stringify({ type: "SALIR", jugador: nombre }));
            }
        } catch (err) {
            console.log("No se pudo enviar SALIR:", err.message);
        }
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
            <Text style={styles.titulo}>🏁 Juego Finalizado</Text>
            <Text style={styles.linea}>⚖️ Izquierdo: {resumenData.totales.izquierdo}g</Text>
            <Text style={styles.linea}>⚖️ Derecho: {resumenData.totales.derecho}g</Text>
            <Text style={styles.linea}>🏆 Ganador: {resumenData.ganador}</Text>
            <Text style={styles.linea}>
                👤 Sobrevivientes: {resumenData.sobrevivientes.join(", ") || "Ninguno"}
            </Text>

            <Text style={styles.subtitulo}>📋 Jugadas:</Text>
            {resumenData.contenido.map((j, i) => (
                <Text key={i} style={styles.turno}>
                    • Turno {j.turno}: {j.jugador} colocó {j.peso}g
                </Text>
            ))}

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
                <Text style={styles.aciertos}>
                    🎉 ¡Adivinaste correctamente {resultadoAciertos} de {misBloques.length} bloques!
                </Text>
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
        marginBottom: 5,
    },
    subtitulo: {
        fontSize: 18,
        fontWeight: "bold",
        marginTop: 30,
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
    aciertos: {
        marginTop: 30,
        fontSize: 18,
        fontWeight: "bold",
        textAlign: "center",
        color: "#27ae60",
    },
});
