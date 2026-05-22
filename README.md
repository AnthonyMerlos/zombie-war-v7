# 🧟 ZOMBIE WAR - Online Multiplayer

## Como ejecutar

```bash
npm install
npm start
```

Luego abre: http://localhost:3000

## Cómo funciona el modo online

1. **Crear servidor**: Un jugador crea el servidor y espera en el lobby
2. **Unirse**: Otros jugadores ven el servidor en la lista y se unen antes de que inicie
3. **Iniciar**: Solo el HOST puede iniciar la partida (botón COMENZAR)
4. **Jugar**: Todos aparecen en el mapa simultáneamente con posiciones asignadas por el servidor

## Reglas online

- ❌ **No se puede unir** a una partida ya iniciada (aparece EN JUEGO en la lista)
- ✅ **Reconexión automática** si se desconecta un jugador
- 🔄 **El host se transfiere** si el creador sale
- 🗺️ **Minimap** muestra todos los jugadores en tiempo real
- 💬 **Chat** con tecla T durante el juego
