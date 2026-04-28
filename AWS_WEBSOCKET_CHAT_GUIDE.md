# Pridanie chatu a reakcií do WebSocket-u v AWS
1. Choď do API Gateway vo svojej AWS konzole
2. Vyber svoje WebSocket API a choď do sekcie **Routes**
3. Vytvor 2 nové routy:
   - \chatMessage\
   - \eaction\
4. Pre \chatMessage\ a \eaction\ routy pridaj integráciu - lambda funkciu, zvoľ tú istú lambdu, ktorá handluje \$connect\, \joinRoom\ apod.
5. Nezabudni znovu deploynúť tvoje API!
6. Update-ni Lambda kód: Zazipuj nanovo zložku \websocket-lambda\, potom nahraj tento .zip v AWS Lambda sekcii.
