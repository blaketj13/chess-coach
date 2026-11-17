/* On-device IndexedDB. No server. */
(function () {
  const DB_NAME = "sparring-coach";
  const DB_VER = 1;
  let _db;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        if (!db.objectStoreNames.contains("games")) db.createObjectStore("games", { keyPath: "id" });
        if (!db.objectStoreNames.contains("cards")) db.createObjectStore("cards", { keyPath: "id" });
        if (!db.objectStoreNames.contains("progress")) db.createObjectStore("progress");
      };
      req.onsuccess = function () { _db = req.result; resolve(_db); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function tx(store, mode) {
    return open().then((db) => db.transaction(store, mode || "readonly").objectStore(store));
  }

  function reqToPromise(r) {
    return new Promise((resolve, reject) => {
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  async function get(store, key) {
    const s = await tx(store);
    return reqToPromise(s.get(key));
  }
  async function set(store, key, value) {
    const s = await tx(store, "readwrite");
    if (store === "games" || store === "cards") return reqToPromise(s.put(value));
    return reqToPromise(s.put(value, key));
  }
  async function del(store, key) {
    const s = await tx(store, "readwrite");
    return reqToPromise(s.delete(key));
  }
  async function all(store) {
    const s = await tx(store);
    return reqToPromise(s.getAll());
  }
  async function clear(store) {
    const s = await tx(store, "readwrite");
    return reqToPromise(s.clear());
  }
  async function wipe() {
    const db = await open();
    const names = Array.from(db.objectStoreNames);
    await Promise.all(names.map((n) => clear(n)));
  }

  window.SCDB = { open, get, set, del, all, clear, wipe };
})();
