const net = require("net");

const HOST = "DangerVSMP.aternos.me";
const PORT = 30776;
const TIMEOUT_MS = 4500;

function writeVarInt(value) {
  const bytes = [];
  let v = value >>> 0;
  while (true) {
    if ((v & ~0x7f) === 0) {
      bytes.push(v);
      break;
    }
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  return Buffer.from(bytes);
}

function readVarInt(buffer, offset = 0) {
  let numRead = 0;
  let result = 0;
  let read;
  do {
    if (offset + numRead >= buffer.length) return null;
    read = buffer[offset + numRead];
    result |= (read & 0x7f) << (7 * numRead);
    numRead++;
    if (numRead > 5) throw new Error("VarInt too big");
  } while ((read & 0x80) !== 0);
  return { value: result, size: numRead };
}

function packData(buf) {
  return Buffer.concat([writeVarInt(buf.length), buf]);
}

function pingMinecraft(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let chunks = Buffer.alloc(0);
    let settled = false;

    const finish = (err, data) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve(data);
    };

    socket.setTimeout(TIMEOUT_MS, () => finish(new Error("Timed out")));
    socket.on("error", (err) => finish(err));

    socket.on("connect", () => {
      const hostBuf = Buffer.from(host, "utf8");
      const portBuf = Buffer.alloc(2);
      portBuf.writeUInt16BE(port, 0);

      const handshake = packData(
        Buffer.concat([
          writeVarInt(0x00),
          writeVarInt(776),
          writeVarInt(hostBuf.length),
          hostBuf,
          portBuf,
          writeVarInt(1),
        ])
      );

      const statusRequest = packData(writeVarInt(0x00));
      socket.write(Buffer.concat([handshake, statusRequest]));
    });

    socket.on("data", (chunk) => {
      chunks = Buffer.concat([chunks, chunk]);
      try {
        const packetLen = readVarInt(chunks, 0);
        if (!packetLen) return;
        const totalNeeded = packetLen.size + packetLen.value;
        if (chunks.length < totalNeeded) return;

        let offset = packetLen.size;
        const packetId = readVarInt(chunks, offset);
        if (!packetId || packetId.value !== 0x00) {
          return finish(new Error("Unexpected packet ID"));
        }
        offset += packetId.size;

        const strLen = readVarInt(chunks, offset);
        if (!strLen) return;
        offset += strLen.size;

        const jsonStr = chunks.subarray(offset, offset + strLen.value).toString("utf8");
        const parsed = JSON.parse(jsonStr);
        finish(null, parsed);
      } catch (err) {
        finish(err);
      }
    });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    const data = await pingMinecraft(HOST, PORT);
    const playersObj = data.players || {};
    const sample = Array.isArray(playersObj.sample) ? playersObj.sample : [];

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        online: true,
        source: "direct-tcp",
        players: {
          online: typeof playersObj.online === "number" ? playersObj.online : sample.length,
          max: playersObj.max || 0,
          list: sample.map((p) => ({
            name_clean: p.name,
            uuid: p.id,
          })),
        },
      })
    );
  } catch {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        online: false,
        source: "direct-tcp",
        players: { online: 0, max: 0, list: [] },
      })
    );
  }
};
