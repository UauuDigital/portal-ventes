// Express 4 no capta rebutjos de promeses als handlers de ruta: aquest
// embolcall reenvia qualsevol error a next(err) perquè arribi al gestor global.
function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

module.exports = asyncHandler;
