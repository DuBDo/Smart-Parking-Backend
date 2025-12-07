module.exports.sendRealtime = (io, room, event, payload) => {
  try {
    if (!io) return;
    io.to(room).emit(event, payload);
  } catch (err) {
    console.error('realtime emit error', err);
  }
};
