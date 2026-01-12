Backend Structure for aviiator

backend/
 ├─ server.js          -> starts the server
 ├─ game/
 │   ├─ engine.js      -> crash logic & bias
 │   └─ rounds.js      -> round lifecycle
 ├─ users/
 │   ├─ auth.js        -> login/signup logic
 │   └─ userStore.js   -> user balances & stats
 ├─ admin/
 │   ├─ controls.js    -> admin powers
 │   └─ settings.js    -> bias %, links, caps
 ├─ database/
 │   └─ models.js      -> database structure
 └─ config/
     └─ settings.js    -> global config
