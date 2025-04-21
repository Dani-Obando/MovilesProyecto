const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const conectarDB = require("./db");
const Jugada = require("./models/Jugada");
const Adivinanza = require("./models/Adivinanza");
const jugadasRoute = require("./routes/jugadas");
const adivinanzasRoute = require("./routes/adivinanzas");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use("/jugadas", jugadasRoute);
app.use("/adivinanzas", adivinanzasRoute);

conectarDB();

let jugadores = [];
let sesionesIndividuales = {};
let equiposPorJugador = {};
let turnoActual = 0;
let totalJugadas = 0;
let bloquesTotales = 0;
let bloquesPorJugador = {};
let pesoIzquierdo = 0;
let pesoDerecho = 0;
let jugadoresListos = false;

let temporizadorInicio = null;
let tiempoRestante = null;

const COLORES = ["red", "blue", "green", "orange", "purple"];

function broadcast(data) {
  const mensaje = typeof data === "string" ? data : JSON.stringify(data);
  jugadores.forEach((j) => {
    if (j.readyState === WebSocket.OPEN) {
      j.send(mensaje);
    }
  });
}

function emparejarJugadores() {
  const nombres = jugadores.map(j => j.nombre);
  const mezclados = nombres.sort(() => Math.random() - 0.5);
  equiposPorJugador = {};

  for (let i = 0; i < mezclados.length; i += 2) {
    const equipoNum = Math.floor(i / 2) + 1;
    equiposPorJugador[mezclados[i]] = equipoNum;
    if (mezclados[i + 1]) equiposPorJugador[mezclados[i + 1]] = equipoNum;
  }

  const equipos = Object.entries(equiposPorJugador).reduce((acc, [nombre, equipo]) => {
    if (!acc[equipo]) acc[equipo] = [];
    acc[equipo].push(nombre);
    return acc;
  }, {});

  broadcast({ type: "EQUIPOS", lista: Object.values(equipos) });
}

function detenerTemporizador() {
  if (temporizadorInicio) {
    clearInterval(temporizadorInicio);
    temporizadorInicio = null;
    tiempoRestante = null;
    broadcast({ type: "TEMPORIZADOR", tiempoRestante: null });
  }
}

function iniciarTemporizadorInicio() {
  if (temporizadorInicio || jugadoresListos) return;

  tiempoRestante = jugadores.length === 10 ? 5 : 20;

  temporizadorInicio = setInterval(() => {
    if (jugadores.length % 2 !== 0) {
      detenerTemporizador();
      return;
    }

    tiempoRestante--;

    broadcast({ type: "TEMPORIZADOR", tiempoRestante });

    if (tiempoRestante <= 0) {
      clearInterval(temporizadorInicio);
      temporizadorInicio = null;
      jugadoresListos = true;

      emparejarJugadores();
      enviarTurno();
    }
  }, 1000);
}

function enviarTurno() {
  if (!jugadoresListos || jugadores.length === 0) return;

  const jugadorActual = jugadores[turnoActual];
  if (!jugadorActual) return;

  const nombreActual = jugadorActual.nombre;
  jugadores.forEach((j, i) => {
    const eq = equiposPorJugador[j.nombre];
    const compañeros = Object.entries(equiposPorJugador)
      .filter(([n, e]) => e === eq && n !== j.nombre)
      .map(([n]) => n);

    if (j.readyState === WebSocket.OPEN) {
      j.send(JSON.stringify({
        type: "TURNO",
        tuTurno: i === turnoActual && !j.eliminado,
        jugadorEnTurno: nombreActual,
        equipo: eq,
        compañeros,
      }));
    }
  });
}

function avanzarTurno() {
  if (jugadores.length === 0) return;
  let intentos = 0;

  do {
    turnoActual = (turnoActual + 1) % jugadores.length;
    intentos++;
  } while (jugadores[turnoActual]?.eliminado && intentos < jugadores.length);

  enviarTurno();
}

function actualizarEquiposYTemporizador() {
  if (jugadores.length >= 2 && jugadores.length % 2 === 0) {
    emparejarJugadores();
    iniciarTemporizadorInicio();
  } else {
    detenerTemporizador();
    emparejarJugadores();
  }
}

wss.on("connection", (ws) => {
  ws.id = Math.random().toString(36).substring(2);
  ws.eliminado = false;

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === "ENTRADA") {
        ws.nombre = msg.jugador;
        ws.modo = msg.modo || "multijugador";

        if (ws.modo === "individual") {
          if (!sesionesIndividuales[ws.nombre] || sesionesIndividuales[ws.nombre].terminado) {
            const bloques = [];
            COLORES.forEach((color) => {
              for (let i = 0; i < 2; i++) {
                bloques.push({ color, peso: Math.floor(Math.random() * 19) + 2 });
              }
            });
            sesionesIndividuales[ws.nombre] = {
              pesoIzquierdo: 0,
              pesoDerecho: 0,
              bloques,
              jugadas: [],
              terminado: false,
            };
          }

          ws.send(JSON.stringify({
            type: "TURNO",
            tuTurno: true,
            jugadorEnTurno: ws.nombre,
          }));
        } else {
          if (jugadores.some(j => j.nombre === msg.jugador)) {
            ws.send(JSON.stringify({
              type: "ERROR",
              mensaje: "Este nombre de jugador ya está en uso.",
            }));
            return;
          }

          if (!bloquesPorJugador[msg.jugador]) {
            const bloques = [];
            COLORES.forEach(color => {
              for (let i = 0; i < 2; i++) {
                bloques.push({ color, peso: Math.floor(Math.random() * 19) + 2 });
                bloquesTotales++;
              }
            });
            bloquesPorJugador[msg.jugador] = bloques;
          }

          jugadores.push(ws);
          broadcast({ type: "ENTRADA", totalJugadores: jugadores.length });

          actualizarEquiposYTemporizador();
        }
      }

      if (msg.type === "JUGADA") {
        if (ws.modo === "individual") {
          const sesion = sesionesIndividuales[ws.nombre];
          if (!sesion || sesion.terminado) return;

          sesion.jugadas.push({ ...msg });
          if (msg.lado === "izquierdo") sesion.pesoIzquierdo += msg.peso;
          else sesion.pesoDerecho += msg.peso;

          ws.send(JSON.stringify({
            type: "ACTUALIZAR_BALANZA",
            izquierdo: sesion.pesoIzquierdo,
            derecho: sesion.pesoDerecho,
            jugador: msg.jugador,
          }));

          if (sesion.jugadas.length >= 10) {
            sesion.terminado = true;

            const resumen = {
              jugador: ws.nombre,
              totales: {
                izquierdo: sesion.pesoIzquierdo,
                derecho: sesion.pesoDerecho,
              },
              contenido: sesion.jugadas,
              sobrevivientes: [ws.nombre],
              bloquesPorJugador: { [ws.nombre]: sesion.bloques },
            };

            ws.send(JSON.stringify({ type: "RESUMEN", ...resumen }));
          } else {
            ws.send(JSON.stringify({
              type: "TURNO",
              tuTurno: true,
              jugadorEnTurno: ws.nombre,
            }));
          }
        } else {
          if (!jugadoresListos) return;

          const jugada = new Jugada({
            jugador: msg.jugador,
            turno: totalJugadas + 1,
            peso: msg.peso,
            equipo: equiposPorJugador[msg.jugador],
            eliminado: false,
            color: msg.color,
          });
          await jugada.save();

          if (msg.lado === "izquierdo") pesoIzquierdo += msg.peso;
          else pesoDerecho += msg.peso;

          broadcast({
            type: "ACTUALIZAR_BALANZA",
            izquierdo: pesoIzquierdo,
            derecho: pesoDerecho,
            jugador: msg.jugador,
          });

          totalJugadas++;
          if (totalJugadas >= bloquesTotales) {
            enviarResumenFinal();
          } else {
            avanzarTurno();
          }
        }
      }

      if (msg.type === "ADIVINANZA") {
        const adivinanza = new Adivinanza(msg);
        await adivinanza.save();
        ws.send(JSON.stringify({ type: "ADIVINANZA_RESULTADO", resultado: "ok" }));
      }
    } catch (err) {
      console.error("❌ Error:", err.message);
    }
  });

  ws.on("close", () => {
    console.log(`🔴 Jugador desconectado: ${ws.nombre}`);
    jugadores = jugadores.filter(j => j !== ws);
    if (turnoActual >= jugadores.length) turnoActual = 0;

    actualizarEquiposYTemporizador();

    if (jugadores.length === 0) {
      jugadoresListos = false;
      tiempoRestante = null;
      equiposPorJugador = {};
      clearInterval(temporizadorInicio);
      temporizadorInicio = null;
    }
  });
});

async function enviarResumenFinal() {
  const jugadas = await Jugada.find().sort({ turno: 1 });

  const resumen = jugadas.map((j) => ({
    jugador: j.jugador,
    turno: j.turno,
    peso: j.peso,
    color: j.color || null,
  }));

  const sobrevivientes = jugadores
    .filter((j) => !j.eliminado)
    .map((j) => j.nombre || "Jugador");

  const ladoGanador =
    pesoIzquierdo === pesoDerecho
      ? "Empate"
      : pesoIzquierdo < pesoDerecho
      ? "Izquierdo"
      : "Derecho";

  broadcast({
    type: "RESUMEN",
    contenido: resumen,
    totales: {
      izquierdo: pesoIzquierdo,
      derecho: pesoDerecho,
    },
    sobrevivientes,
    ganador: ladoGanador,
    bloquesPorJugador,
  });
}

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor listo en http://localhost:${PORT}`);
});
