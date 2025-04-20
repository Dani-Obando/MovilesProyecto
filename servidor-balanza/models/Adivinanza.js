const mongoose = require("mongoose");

const adivinanzaSchema = new mongoose.Schema({
    jugador: { type: String, required: true },
    aciertos: { type: Number, required: true },
    bloques: [
        {
            intento: Number,
            pesoReal: Number,
            acertado: Boolean,
        },
    ],
    fecha: { type: Date, default: Date.now },
});

const Adivinanza = mongoose.model("Adivinanza", adivinanzaSchema);
module.exports = Adivinanza;
