// ---------- script.js (Game logic) ----------
console.log("script.js loaded");

window.addEventListener("DOMContentLoaded", () => {
  // ---------- DOM REFS ----------
  const dailyBtn = document.getElementById("dailyBtn");
  const endlessBtn = document.getElementById("endlessBtn");
  const dailyMode = document.getElementById("dailyMode");
  const endlessMode = document.getElementById("endlessMode");

  const guessInput = document.getElementById("guessInput");
  const autocompleteList = document.getElementById("autocompleteList");
  const resultMessage = document.getElementById("resultMessage");
  const resultList = document.getElementById("result-list");
  const clues = Array.from(document.querySelectorAll(".clue"));
  const resetBtn = document.getElementById("resetBtn");

  // ---------- INTERNAL STATE ----------
  let guesses = 0;
  let answer = null;
  let suggestionItems = [];
  let activeSuggestion = -1;

  // ---------- MODE SWITCH ----------
  function showMode(mode) {
    if (mode === "daily") {
      dailyBtn.classList.add("active");
      endlessBtn.classList.remove("active");
      dailyMode.classList.add("active");
      endlessMode.classList.remove("active");
    } else {
      endlessBtn.classList.add("active");
      dailyBtn.classList.remove("active");
      endlessMode.classList.add("active");
      dailyMode.classList.remove("active");
    }
  }

    // ---------- CLUE CLICK HANDLERS ----------
  clues.forEach((clue, i) => {
    clue.addEventListener("click", () => {
      if (clue.disabled || !answer) return;

      if (i === 0) {
        clue.textContent = `Patch Release: ${answer.patch || "???"}`;
      }
      if (i === 1) {
        clue.textContent = `Bond/Title: ${answer.bond || "???"}`;
      }
      if (i === 2) {
        clue.textContent = `Voice Line: ${answer.signatureWeapon || "???"}`;
      }

      clue.disabled = true; // lock again after reveal
      clue.classList.remove("unlocked");
    });
  });

  dailyBtn.addEventListener("click", () => showMode("daily"));
  endlessBtn.addEventListener("click", () => showMode("endless"));

  // ---------- PICK NEW ANSWER ----------
  function pickAnswer() {
    if (!Array.isArray(resonators) || resonators.length === 0) {
      console.error("resonators is missing or empty");
      return;
    }
    answer = resonators[Math.floor(Math.random() * resonators.length)];
    guesses = 0;

    // reset UI
    resultList.innerHTML = "";
    resultMessage.classList.add("hidden");
    guessInput.disabled = false;
    guessInput.value = "";
    clearSuggestions();

    // reset clues (only here, not in submitGuess!)
    clues.forEach((c, i) => {
      c.disabled = true;
      c.classList.remove("unlocked");

      let baseLabel = "";
      if (i === 0) baseLabel = "Patch Release";
      if (i === 1) baseLabel = "Bond Line";
      if (i === 2) baseLabel = "Signature Weapon";

      const unlock = c.dataset.unlock;
      if (unlock) {
        c.innerText = `${baseLabel} (Unlocks in ${unlock} guesses)`;
      } else {
        c.innerText = baseLabel;
      }
    });

    console.log("Pick answer (dev):", answer.name);
  }

  pickAnswer(); // initial call

  // ---------- RESET BUTTON ----------
  resetBtn.addEventListener("click", () => {
    pickAnswer();
  });

  // ---------- AUTOCOMPLETE ----------
  function clearSuggestions() {
    autocompleteList.innerHTML = "";
    autocompleteList.style.display = "none";
    suggestionItems = [];
    activeSuggestion = -1;
  }

  function renderSuggestions(filter) {
    clearSuggestions();
    let matches = resonators;

    if (filter) {
      const q = filter.toLowerCase();
      matches = resonators.filter((r) =>
        r.name.toLowerCase().includes(q)
      );
    }

    if (matches.length === 0) return;

    matches.forEach((r, idx) => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";

      const img = document.createElement("img");
      img.src = r.img || "https://via.placeholder.com/64?text=?";
      img.alt = r.name;
      img.className = "autocomplete-img";
      item.appendChild(img);

      const txt = document.createElement("div");
      txt.textContent = r.name;
      item.appendChild(txt);

      item.dataset.name = r.name;
      item.addEventListener("click", () => selectSuggestion(idx));

      autocompleteList.appendChild(item);
      suggestionItems.push(item);
    });

    autocompleteList.style.display = "block";
  }

  function selectSuggestion(index) {
    if (index < 0 || index >= suggestionItems.length) return;
    const name = suggestionItems[index].dataset.name;
    guessInput.value = name;
    clearSuggestions();
    submitGuess(name);
  }

  // keyboard navigation
  guessInput.addEventListener("keydown", (e) => {
    if (
      autocompleteList.style.display === "block" &&
      (e.key === "ArrowDown" || e.key === "ArrowUp")
    ) {
      e.preventDefault();
      const max = suggestionItems.length - 1;
      if (e.key === "ArrowDown") activeSuggestion = Math.min(max, activeSuggestion + 1);
      if (e.key === "ArrowUp") activeSuggestion = Math.max(0, activeSuggestion - 1);
      suggestionItems.forEach((it, i) =>
        it.classList.toggle("active", i === activeSuggestion)
      );
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (autocompleteList.style.display === "block") {
        if (activeSuggestion >= 0) {
          selectSuggestion(activeSuggestion);
        } else if (suggestionItems.length > 0) {
          selectSuggestion(0);
        }
      } else {
        const txt = guessInput.value.trim();
        if (txt) submitGuess(txt);
      }
    }

    if (e.key === "Escape") clearSuggestions();
  });

  // input event → always show list (filtered if typing, full if empty)
  guessInput.addEventListener("input", (e) => {
    renderSuggestions(e.target.value.trim());
  });

  // click outside → hide suggestions
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest(".guess-input") &&
      !e.target.closest(".autocomplete-list")
    ) {
      clearSuggestions();
    }
  });

  // focus → show all options (like FGOdle)
  guessInput.addEventListener("focus", () => {
    renderSuggestions("");
  });

  // ---------- GUESS LOGIC ----------
  function colorClass(value, answerValue) {
    if (value === answerValue) return "correct";
    if (
      answerValue &&
      (answerValue.toLowerCase().includes(String(value).toLowerCase()) ||
        String(value).toLowerCase().includes(answerValue.toLowerCase()))
    )
      return "partial";
    return "wrong";
  }

  function submitGuess(guessName) {
    const match = resonators.find(
      (r) => r.name.toLowerCase() === guessName.toLowerCase()
    );
    if (!match) {
      resultMessage.textContent = "❌ No resonator found!";
      resultMessage.classList.remove("hidden");
      return;
    }

    guesses++;

    // create row
    const row = document.createElement("div");
    row.className = "result-row";

    // Resonator (Image)
    const resCell = document.createElement("div");
    resCell.className = `cell ${colorClass(match.name, answer.name)}`;
    const resImg = document.createElement("img");
    resImg.src = match.img || "https://via.placeholder.com/64?text=?";
    resImg.alt = match.name;
    resImg.className = "resonator-img";
    resCell.appendChild(resImg);
    row.appendChild(resCell);

    // Weapon
    const weaponCell = document.createElement("div");
    weaponCell.className = `cell ${colorClass(match.weapon, answer.weapon)}`;
    weaponCell.textContent = match.weapon;
    row.appendChild(weaponCell);

    // Attribute
    const attrCell = document.createElement("div");
    attrCell.className = `cell ${colorClass(match.attribute, answer.attribute)}`;
    attrCell.textContent = match.attribute;
    row.appendChild(attrCell);

    // Nation
    const nationCell = document.createElement("div");
    nationCell.className = `cell ${colorClass(match.nation, answer.nation)}`;
    nationCell.textContent = match.nation;
    row.appendChild(nationCell);

    // Boss Material
    const bossCell = document.createElement("div");
    bossCell.className = `cell ${colorClass(match.bossMaterial, answer.bossMaterial)}`;
    bossCell.textContent = match.bossMaterial;
    row.appendChild(bossCell);

    // NEW: prepend instead of append (latest guess at top)
    resultList.prepend(row);

    // update clues (unlocking)
    clues.forEach((clue) => {
      const unlockAt = parseInt(clue.dataset.unlock, 10);
      if (guesses >= unlockAt) {
        clue.disabled = false;
        clue.classList.add("unlocked");
        if (/\(Unlocks/.test(clue.textContent)) {
          clue.textContent = clue.textContent.replace(/\(Unlocks.*\)/, "(Ready)");
        }
      }
    });

    // win condition
    if (match.name === answer.name) {
      resultMessage.textContent = `✅ Correct! The resonator was ${answer.name}`;
      resultMessage.classList.remove("hidden");
      guessInput.disabled = true;
      clearSuggestions();
      return;
    }

    // reset input
    guessInput.value = "";
    clearSuggestions();
  }

  // expose for debugging
  window.GAME = { pickAnswer, submitGuess };

  // ensure mode visible
  showMode("endless");
});
