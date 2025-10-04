// script.js (Version avec correction DÉFINITIVE des chemins de fichiers)

// --- FONCTIONS DE DÉBOGAGE PERSONNALISÉES ---
const debugElement = document.getElementById('debug');
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

function appendToDebug(message, type = 'log') {
    if (debugElement) {
        const p = document.createElement('p');
        p.style.whiteSpace = 'pre-wrap'; // Pour conserver les retours à la ligne dans le JSON
        p.textContent = `[${type.toUpperCase()}] ${new Date().toLocaleTimeString()} : ${message}`;
        if (type === 'error') {
            p.style.color = 'red';
        } else if (type === 'warn') {
            p.style.color = 'orange';
        } else if (type === 'info') {
            p.style.color = 'blue';
        }
        debugElement.appendChild(p);
        debugElement.scrollTop = debugElement.scrollHeight;
    }
}

// Override console.log
console.log = function(...args) {
    originalConsoleLog.apply(console, args); 
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    appendToDebug(message, 'log');
};

// Override console.warn
console.warn = function(...args) {
    originalConsoleWarn.apply(console, args); 
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    appendToDebug(message, 'warn');
};

// Override console.error
console.error = function(...args) {
    originalConsoleError.apply(console, args); 
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    appendToDebug(message, 'error');
};

// Modifie window.onerror pour utiliser appendToDebug
window.onerror = function(msg, url, line, col, error) {
    const errorMessage = "Erreur JS : " + msg + "\nLigne: " + line + "\n" + (error ? error.stack : "");
    appendToDebug(errorMessage, 'error');
    return false; 
};
// --- FIN FONCTIONS DE DÉBOGAGE PERSONNALISÉES ---

console.log("script.js chargé."); 

const MATIERES_BASE_PATH = 'matieres'; 
let selectedItems = []; 
let currentQuizData = []; 
let currentQuestionIndex = 0;
let totalQuizPoints = 0; 
let userScore = 0; 
let isQuizRunning = false; 

const BASE_API_URL = 'https://cle-api.onrender.com';
const CORRECTION_API_URL = `${BASE_API_URL}/correction`; 
const GENERATION_API_URL = `${BASE_API_URL}/generation`; 
const AUDIO_GENERATION_API_URL = `${BASE_API_URL}/generate-audio`; 

let currentAudioPlayer = null;
let listenCount = 0;
let maxListens = 3; 

// --- STRUCTURE DES MATIÈRES ---
// Basée sur les chemins de fichiers que tu as fournis.
const STRUCTURE = {
    "Anglais": {
        "Culture": [ 
            { name: "Les pays anglophones", file: "Les pays anglophones.txt" } 
        ]
    },
    "Francais": {
        "Analyse": [
            { name: "Analyse d'un texte", file: "Analyse d'un texte .txt" } 
        ],
        "Écriture": [ 
            { name: "L'Autoportrait", file: "Autoportrait.txt" },
            { name: "Qui est je", file: "Qui est je.txt" } 
        ],
        "Grammaire": [
            { name: "L'accord du verbe et du sujet", file: "L'accord du verbe et du sujet .txt" },
            { name: "Les classes grammaticales", file: "Les classes grammaticales.txt" }
        ],
        "Conjugaison": [
            { name: "Les Temps Simples de l'Indicatif", file: "Les Temps Simples de l'Indicatif.txt" }
        ]
    },
    "Histoire_Geo": {
        "Geographie": [ 
            { name: "Les aires urbaines", file: "Les aires urbaines.txt" } 
        ]
    },
    "Mathematiques": {
        "G1-Triangles et proportionnalité": [ 
            { name: "Triangles et proportionnalité", file: "Triangles et proportionnalité.txt" } 
        ],
        "T1_STATISTIQUES": [ 
            { name: "Statistiques", file: "Statistiques.txt" } 
        ]
    },
    "Physique-Chimie": {
        "Chimie": [ 
            { name: "Atomes et Tableau Périodique", file: "Atomes+tableau périodique.txt" } 
        ]
    },
    "Science-de-la-Vie-et-de-la-Terre": { 
        "Biologie": [ 
            { name: "L'Hérédité (Génétique)", file: "L'Hérédité (Génétique).txt" },
            { name: "Le programme génétique", file: "Le programme génétique.txt" }
        ]
    },
    "Musique": {
        "Histoire": [ 
            { name: "La Chanson Engagée", file: "Chanson engagée.txt" } 
        ]
    },
    "Technologie": {
        "Systèmes": [ 
            { name: "Les systèmes automatisés", file: "Les-systèmes-automatisés.txt" } 
        ]
    }
};
// --- FIN STRUCTURE DES MATIÈRES ---

document.addEventListener('DOMContentLoaded', () => {
    displayMenu();
    document.getElementById('start-quiz-btn').addEventListener('click', () => startQuiz('mixed')); 
    const startQCMBtn = document.getElementById('start-qcm-btn');
    if (startQCMBtn) {
        startQCMBtn.addEventListener('click', () => startQuiz('qcm'));
    } else {
        console.warn("Bouton 'start-qcm-btn' non trouvé. Assurez-vous qu'il existe dans votre HTML.");
    }

    const startParagrapheBtn = document.getElementById('start-paragraphe-btn');
    if (startParagrapheBtn) {
        startParagrapheBtn.addEventListener('click', () => startQuiz('paragraphe_ia'));
    } else {
        console.warn("Bouton 'start-paragraphe-btn' non trouvé. Assurez-vous qu'il existe dans votre HTML.");
    }

    const startDictationBtn = document.getElementById('start-dictation-btn');
    if (startDictationBtn) {
        startDictationBtn.addEventListener('click', () => startQuiz('audio_dictation'));
    } else {
        console.warn("Bouton 'start-dictation-btn' non trouvé. Assurez-vous qu'il existe dans votre HTML.");
    }
});

function displayMenu() {
    const menuContainer = document.getElementById('menu-container');
    menuContainer.innerHTML = ''; 

    for (const matiereName in STRUCTURE) {
        const matiereDiv = document.createElement('div');
        matiereDiv.className = 'matiere';
        matiereDiv.innerHTML = `<h2>${matiereName.replace(/-/g, ' ')}</h2>`; 

        for (const chapitreName in STRUCTURE[matiereName]) {
            const chapitreDiv = document.createElement('div');
            chapitreDiv.className = 'chapitre';
            chapitreDiv.innerHTML = `<h3>${chapitreName.replace(/-/g, ' ')}</h3>`; 

            STRUCTURE[matiereName][chapitreName].forEach(lecon => {
                let path;
                // --- CORRECTION CLÉ ICI : SEULEMENT LES MATHS ONT UN SOUS-DOSSIER DE CHAPITRE RÉEL ---
                if (matiereName === "Mathematiques") {
                    path = `${MATIERES_BASE_PATH}/${matiereName}/${chapitreName}/${lecon.file}`;
                } else {
                    // Pour toutes les autres matières, le fichier est directement dans le dossier de la matière.
                    // Le 'chapitreName' est seulement pour l'affichage dans le menu.
                    path = `${MATIERES_BASE_PATH}/${matiereName}/${lecon.file}`;
                }
                
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" data-path="${path}" data-name="${matiereName} - ${lecon.name}"> ${lecon.name}`;
                label.querySelector('input').addEventListener('change', toggleSelection);
                chapitreDiv.appendChild(label);
            });
            matiereDiv.appendChild(chapitreDiv);
        }
        menuContainer.appendChild(matiereDiv);
    }
}

function toggleSelection(event) {
    const checkbox = event.target;
    const path = checkbox.dataset.path;
    const name = checkbox.dataset.name;

    if (checkbox.checked) {
        selectedItems.push({ path: path, name: name });
    } else {
        selectedItems = selectedItems.filter(item => item.path !== path);
    }
    updateSelectedItems();
}

function updateSelectedItems() {
    const selectedBox = document.getElementById('selected-items');
    if (selectedItems.length === 0) {
        selectedBox.innerHTML = 'Aucun sujet sélectionné';
        document.getElementById('start-quiz-btn').style.display = 'none';
        const startQCMBtn = document.getElementById('start-qcm-btn');
        if (startQCMBtn) startQCMBtn.style.display = 'none';
        const startParagrapheBtn = document.getElementById('start-paragraphe-btn');
        if (startParagrapheBtn) startParagrapheBtn.style.display = 'none';
        const startDictationBtn = document.getElementById('start-dictation-btn');
        if (startDictationBtn) startDictationBtn.style.display = 'none';
    } else {
        selectedBox.innerHTML = selectedItems.map(item => item.name).join(', ');
        document.getElementById('start-quiz-btn').style.display = 'block';
        const startQCMBtn = document.getElementById('start-qcm-btn');
        if (startQCMBtn) startQCMBtn.style.display = 'block';
        const startParagrapheBtn = document.getElementById('start-paragraphe-btn');
        if (startParagrapheBtn) startParagrapheBtn.style.display = 'block';
        const startDictationBtn = document.getElementById('start-dictation-btn');
        if (startDictationBtn) startDictationBtn.style.display = 'block';
    }
}


// --- Lancement et Génération du Quiz ---

async function startQuiz(quizType = 'mixed') { 
    if (selectedItems.length === 0) {
        alert("Veuillez sélectionner au moins un sujet.");
        return;
    }

    if (isQuizRunning) return; 
    isQuizRunning = true;
    
    document.getElementById('selection-view').style.display = 'none';
    document.getElementById('quiz-view').style.display = 'block';
    document.getElementById('question-container').innerHTML = '<p>Préparation du quiz... ⏳</p>';
    document.getElementById('ai-generation-feedback').innerHTML = ''; 
    
    if (debugElement) {
        debugElement.innerHTML = ''; 
        appendToDebug("Début du quiz. Vide le journal de débogage.", 'info');
    }

    currentQuizData = [];
    currentQuestionIndex = 0;
    userScore = 0;
    totalQuizPoints = 0;

    const NUM_QUESTIONS_TO_GENERATE = Math.floor(Math.random() * 6) + 5; 
    console.log(`Demande de génération de ${NUM_QUESTIONS_TO_GENERATE} questions de type '${quizType}'.`);

    const generationFeedbackDiv = document.getElementById('ai-generation-feedback');
    generationFeedbackDiv.innerHTML = `<p>Génération de ${NUM_QUESTIONS_TO_GENERATE} questions de type ${quizType} par sujet sélectionné (${selectedItems.length} sujet(s)).</p>`;
    
    let combinedContent = '';
    try {
        const fetchPromises = selectedItems.map(item => fetchFileContent(item.path));
        const results = await Promise.all(fetchPromises);
        combinedContent = results.join('\n\n---\n\n');
        console.log("Contenu des leçons chargé et combiné.");
    } catch (error) {
        document.getElementById('question-container').innerHTML = `<p class="error">❌ Erreur lors du chargement des fichiers de leçon. Détails: ${error.message}</p>`;
        console.error("Erreur chargement fichiers:", error);
        isQuizRunning = false;
        return;
    }
    
    try {
        const aiData = await callGenerationAPI(combinedContent, quizType, NUM_QUESTIONS_TO_GENERATE); 
        console.log("Données AI brutes reçues:", aiData);

        if (aiData && aiData.generated_content) {
            const jsonQuestions = JSON.parse(aiData.generated_content);
            console.log("JSON des questions parsé:", jsonQuestions);

            if (jsonQuestions.questions && Array.isArray(jsonQuestions.questions)) {
                currentQuizData = jsonQuestions.questions;
                generationFeedbackDiv.innerHTML = `<p class="correct">✅ Questions générées ! Début du quiz.</p>`;
                
                if (currentQuizData.length > 0) {
                    const firstQCM = currentQuizData.find(q => q.type === 'qcm');
                    if (firstQCM) {
                        appendToDebug("Structure de la première question QCM détectée : \n" + 
                            JSON.stringify(firstQCM, null, 2), 'info');
                    } else {
                        appendToDebug("Aucune question QCM trouvée dans les données générées.", 'warn');
                    }

                    displayCurrentQuestion();
                } else {
                    document.getElementById('question-container').innerHTML = `<p>L'IA n'a généré aucune question pour ces sujets. Veuillez réessayer.</p>`;
                    appendToDebug("L'IA n'a généré aucune question.", 'warn');
                }
            } else {
                console.error("Format JSON de l'IA invalide:", jsonQuestions);
                document.getElementById('question-container').innerHTML = `<p class="error">❌ Erreur : Le format JSON des questions générées par l'IA est invalide. Vérifiez les logs Render de votre backend.</p>`;
            }
        } else {
            console.error("Réponse de l'API de génération incomplète ou mal formée:", aiData);
            document.getElementById('question-container').innerHTML = `<p class="error">❌ L'IA n'a pas pu générer le contenu. Réponse inattendue du serveur.</p>`;
        }
    } catch (error) {
        console.error("Erreur lors de la génération par l'IA:", error);
        document.getElementById('question-container').innerHTML = `<p class="error">❌ Erreur de connexion à l'IA ou format de réponse invalide.
            Détails: ${error.message}. <br>
            **ATTENTION :** Si l'erreur mentionne "Rate limit reached", patientez avant de réessayer ou mettez à jour votre compte OpenAI.
            Vérifiez l'URL de votre serveur Render et les logs de votre backend.
        </p>`;
        isQuizRunning = false;
    }
}

async function fetchFileContent(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Le fichier de leçon ${path} n'a pas été trouvé (Status: ${response.status}).`);
    }
    return response.text();
}

// --- Nouvelle fonction pour formater le Markdown (gras) ---
function formatMarkdownBold(text) {
    if (!text) return '';
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

// --- Nouvelle fonction pour générer et jouer l'audio ---
async function generateAndPlayAudioFromBackend(textToSpeak, audioPlayerElement, playButtonElement, listenCountElement) {
    playButtonElement.disabled = true;
    listenCount = 0; 
    currentAudioPlayer = null; 

    if (textToSpeak.length > 4096) { 
        alert("Le texte est trop long pour être converti en audio. Max 4096 caractères.");
        playButtonElement.disabled = false;
        return;
    }

    try {
        listenCountElement.innerHTML = "Génération audio... 🎧";
        
        const response = await fetch(AUDIO_GENERATION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textToSpeak, language: 'fr' }) 
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Erreur serveur TTS inconnue." }));
            throw new Error(`Erreur génération audio: Statut ${response.status}. Détails: ${errorData.message || response.statusText}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        currentAudioPlayer = new Audio(audioUrl);
        currentAudioPlayer.onended = () => {
            playButtonElement.disabled = false;
            listenCountElement.textContent = `Écoutes restantes: ${maxListens - listenCount}`;
            if (listenCount >= maxListens) {
                playButtonElement.disabled = true; 
            }
        };
        
        currentAudioPlayer.play();
        listenCount++;
        listenCountElement.textContent = `Écoutes restantes: ${maxListens - listenCount}`;
        playButtonElement.disabled = (listenCount >= maxListens); 

    } catch (error) {
        console.error("Erreur lors de la génération ou lecture audio:", error);
        listenCountElement.innerHTML = `Erreur audio: ${error.message}`;
        playButtonElement.disabled = false; 
    }
}


async function callGenerationAPI(topicContent, type, count) {
    let instruction = "";
    const strictnessInstruction = `**Réponds UNIQUEMENT en te basant sur le "Contenu de la leçon" fourni.** Ne fais pas d'inférences, ne tire pas de conclusions ou ne demande pas de comparaisons qui ne sont pas explicitement supportées par le texte que je te donne. Ne pas utiliser de connaissances externes.`;

    if (type === 'mixed') {
        instruction = `${strictnessInstruction} Génère ${count} questions de quiz. 
        Pour les questions, utilise un langage clair et direct. Les formules mathématiques ou expressions scientifiques doivent être écrites en texte simple, **sans utiliser de notation LaTeX ou de symboles spéciaux non standard HTML** (par exemple, écris "AM divisé par AB" ou "AM/AB" au lieu de "\\frac{AM}{AB}").
        Mélange des questions à choix multiples (QCM) et des sujets de rédaction de paragraphe.
        Pour chaque QCM, fournis la question (clé 'question'), une liste de 3-4 options (clé 'options', comme un tableau de chaînes), la bonne réponse (clé 'bonne_reponse', une chaîne qui correspond à l'une des options) et une courte explication (clé 'explication'). **Attribue également un champ 'points' à chaque QCM avec une valeur numérique entre 1 et 3 (plus la question est difficile, plus de points).**
        Pour les sujets de paragraphe, fournis le sujet (clé 'sujet') et une consigne détaillée pour un professeur qui corrigera la réponse, en lui demandant de noter sur 10 (clé 'consigne_ia').`;
    } else if (type === 'qcm') {
        instruction = `${strictnessInstruction} Génère ${count} questions à choix multiples (QCM). 
        Pour les questions, utilise un langage clair et direct. Les formules mathématiques ou expressions scientifiques doivent être écrites en texte simple, **sans utiliser de notation LaTeX ou de symboles spéciaux non standard HTML**.
        Pour chaque QCM, fournis la question (clé 'question'), une liste de 3-4 options (clé 'options', comme un tableau de chaînes), la bonne réponse (clé 'bonne_reponse', une chaîne qui correspond à l'une des options) et une courte explication (clé 'explication'). **Attribue également un champ 'points' à chaque QCM avec une valeur numérique entre 1 et 3 (plus la question est difficile, plus de points).**`;
    } else if (type === 'paragraphe_ia') {
        instruction = `${strictnessInstruction} Génère ${count} sujets de rédaction de paragraphe. 
        Pour chaque sujet, fournis le sujet (clé 'sujet') et une consigne détaillée pour un professeur qui corrigera la réponse, en lui demandant de noter sur 10 (clé 'consigne_ia').`;
    } else if (type === 'audio_dictation') {
        instruction = `${strictnessInstruction} Génère ${count} textes courts et clairs pour une dictée, basés sur le contenu de leçon fourni. Chaque texte doit être une phrase ou deux, adapté à un élève de 3ème. Chaque objet doit avoir une clé 'text' pour le texte de la dictée et une clé 'points' pour la difficulté (entre 1 et 3). **Ne pose pas de questions, fournis juste le texte.**`;
    } 
    else {
        throw new Error("Type de génération de questions inconnu.");
    }

    const full_prompt = `${instruction} Le résultat doit être un tableau JSON nommé "questions", où chaque objet représente une question, et inclut un champ "type" ("qcm", "paragraphe_ia" ou "audio_dictation"). Contenu de la leçon: """${topicContent}"""`;
    console.log("Envoi du prompt à l'API de génération (début):", full_prompt.substring(0, 500) + "..."); 

    const response = await fetch(GENERATION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_prompt: full_prompt })
    });
    
    if (!response.ok) {
        const errorBody = await response.text(); 
        throw new Error(`Erreur réseau lors de la génération: Statut ${response.status} (${response.statusText}). Réponse du serveur: ${errorBody || "Aucun détail de réponse."}`);
    }
    return response.json();
}

async function callCorrectionAPI(prompt) {
    console.log("Envoi du prompt à l'API de correction (début):", prompt.substring(0, 500) + "..."); 
    const response = await fetch(CORRECTION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt })
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Erreur réseau lors de la correction: Statut ${response.status} (${response.statusText}). Réponse du serveur: ${errorBody || "Aucun détail de réponse."}`);
    }
    const data = await response.json();
    console.log("Réponse de l'API de correction:", data);
    return data.correction_text;
}


// --- Affichage des questions ---

function displayCurrentQuestion() {
    const container = document.getElementById('question-container');
    const questionData = currentQuizData[currentQuestionIndex];

    if (!questionData) {
        showFinalScore(); 
        return;
    }
    console.log(`Affichage de la question ${currentQuestionIndex + 1}:`, questionData);

    container.innerHTML = `<h3>Question ${currentQuestionIndex + 1} / ${currentQuizData.length}</h3>`;
    document.getElementById('correction-feedback').innerHTML = '';
    document.getElementById('next-question-btn').style.display = 'none';

    if (questionData.type === 'qcm') {
        renderQCM(questionData, container);
    } else if (questionData.type === 'paragraphe_ia') {
        renderParagraphe(questionData, container);
    } else if (questionData.type === 'audio_dictation') { 
        renderAudioDictation(questionData, container);
    } 
    else {
        container.innerHTML += `<p class="error">Type de question inconnu.</p>`;
        appendToDebug(`Type de question inconnu: ${questionData.type}`, 'error');
        document.getElementById('next-question-btn').style.display = 'block';
    }
}

function renderQCM(questionData, container) {
    const qcmPoints = questionData.points && typeof questionData.points === 'number' ? questionData.points : 1;
    totalQuizPoints += qcmPoints; 
    console.log("Rendu QCM. Question:", questionData.question, "Options:", questionData.options, "Bonne réponse attendue (dans les données):", questionData.bonne_reponse, `(vaut ${qcmPoints} points)`); 

    let html = `
        <div class="qcm-question">
            <h4>${formatMarkdownBold(questionData.question)} <span class="qcm-points">(${qcmPoints} points)</span></h4>
            <div id="options-container">
    `;

    questionData.options.forEach((option, index) => {
        html += `
            <label>
                <input type="radio" name="qcm-option" value="${formatMarkdownBold(option)}">
                ${formatMarkdownBold(option)}
            </label>
        `;
    });

    html += `
            </div>
            <button onclick="submitQCM()">Valider</button>
        </div>
    `;
    container.innerHTML += html;
}


function renderParagraphe(questionData, container) {
    totalQuizPoints += 10; 
    console.log("Rendu Paragraphe. Sujet:", questionData.sujet);

    let html = `
        <div class="paragraphe-sujet">
            <h4>Sujet de Rédaction (Noté sur 10) :</h4>
            <p>${formatMarkdownBold(questionData.sujet)}</p>
            <textarea id="ia-answer" rows="10" placeholder="Rédigez votre paragraphe argumenté ici (min. 50 caractères)..."></textarea>
            <button onclick="submitParagrapheIA()">Soumettre à l'IA pour correction</button>
        </div>
    `;
    container.innerHTML += html;
}

function renderAudioDictation(questionData, container) {
    const dictationPoints = questionData.points && typeof questionData.points === 'number' ? questionData.points : 1;
    totalQuizPoints += dictationPoints;
    console.log("Rendu Dictée Audio. Texte:", questionData.text, `(vaut ${dictationPoints} points)`);

    let html = `
        <div class="audio-dictation-question">
            <h4>Dictée (Notée sur ${dictationPoints} points) :</h4>
            <p>Écoutez le texte et transcrivez-le.</p>
            <button id="play-audio-btn" style="padding: 10px 20px; font-size: 1.2em;">▶️ Écouter</button>
            <span id="listen-count-display" style="margin-left: 10px;">Écoutes restantes: ${maxListens}</span>
            <textarea id="dictation-answer" rows="5" placeholder="Écrivez le texte que vous entendez ici..."></textarea>
            <button onclick="submitDictation()">Valider la dictée</button>
        </div>
    `;
    container.innerHTML += html;

    const playButton = document.getElementById('play-audio-btn');
    const listenCountDisplay = document.getElementById('listen-count-display');

    playButton.disabled = true; 
    generateAndPlayAudioFromBackend(
        questionData.text, 
        currentAudioPlayer, 
        playButton, 
        listenCountDisplay
    );

    playButton.addEventListener('click', () => {
        if (currentAudioPlayer && listenCount < maxListens) {
            currentAudioPlayer.play();
            listenCount++;
            listenCountDisplay.textContent = `Écoutes restantes: ${maxListens - listenCount}`;
            if (listenCount >= maxListens) {
                playButton.disabled = true;
            }
        }
    });
}

// --- Soumission et Correction ---

function submitQCM() {
    console.log("submitQCM() déclenché."); 
    const questionData = currentQuizData[currentQuestionIndex];
    const optionsContainer = document.getElementById('options-container');
    const resultDiv = document.getElementById('correction-feedback');
    const selectedOption = document.querySelector('input[name="qcm-option"]:checked');

    if (!selectedOption) {
        alert("Veuillez sélectionner une réponse.");
        appendToDebug("Tentative de soumission QCM sans option sélectionnée.", 'warn');
        return;
    }

    const userAnswer = selectedOption.value;
    const correctAnswer = formatMarkdownBold(questionData.bonne_reponse); 
    const qcmPoints = questionData.points && typeof questionData.points === 'number' ? questionData.points : 1; 

    if (typeof correctAnswer === 'undefined' || correctAnswer === null) {
        appendToDebug(`Erreur: La bonne réponse ('bonne_reponse') est undefined ou null pour cette question QCM. Question ID: ${questionData.id || 'N/A'}`, 'error');
        resultDiv.innerHTML = `<p class="error">❌ Erreur : La bonne réponse n'a pas été trouvée pour cette question. Impossible de valider.</p>`;
        document.getElementById('next-question-btn').style.display = 'block';
        return;
    }

    console.log("Réponse utilisateur QCM:", userAnswer, " | Réponse correcte attendue:", correctAnswer, `(vaut ${qcmPoints} points)`);


    optionsContainer.querySelectorAll('input').forEach(input => input.disabled = true);
    document.querySelector('.qcm-question button').style.display = 'none'; 

    let feedback = '';
    if (userAnswer === correctAnswer) {
        feedback = `<p class="correct">✅ **Bonne réponse !** Vous gagnez ${qcmPoints} points.</p>`;
        userScore += qcmPoints; 
        console.log(`Bonne réponse QCM. Score actuel: ${userScore}`);
    } else {
        feedback = `<p class="incorrect">❌ **Mauvaise réponse.**</p>`;
        console.log("Mauvaise réponse QCM.");
    }
    
    feedback += `<p>La bonne réponse était : **${correctAnswer}**.</p>`; 
    if (questionData.explication) {
        feedback += `<p>Explication : ${formatMarkdownBold(questionData.explication)}</p>`;
    }

    resultDiv.innerHTML = feedback;
    document.getElementById('next-question-btn').style.display = 'block';
}


async function submitParagrapheIA() {
    console.log("submitParagrapheIA() déclenché."); 
    const questionData = currentQuizData[currentQuestionIndex];
    const userAnswer = document.getElementById('ia-answer').value.trim();
    const resultDiv = document.getElementById('correction-feedback');

    if (userAnswer.length < 50) {
        alert("Veuillez écrire un paragraphe plus long (minimum 50 caractères).");
        appendToDebug("Tentative de soumission Paragraphe trop court.", 'warn');
        return;
    }
    
    document.getElementById('ia-answer').disabled = true;
    document.querySelector('.paragraphe-sujet button').disabled = true;

    resultDiv.innerHTML = '<p>Correction par l\'IA en cours... 🧠</p>';
    
    const horsSujetRule = "RÈGLE CRITIQUE : Si le texte de l'élève est manifestement **hors sujet** (parle d'une autre notion que le sujet demandé), la note doit être **0/10** et vous devez le mentionner clairement dans vos commentaires.";
    
    const prompt = `${questionData.consigne_ia} ${horsSujetRule}\n\nTexte de l'élève à corriger:\n\n---\n${userAnswer}\n---`;
    
    try {
        const responseText = await callCorrectionAPI(prompt); 
        
        const scoreMatch = responseText.match(/Note\s*:\s*(\d+(\.\d+)?)\s*\/\s*10/i);
        let iaScore = 0;
        if (scoreMatch) {
            iaScore = parseFloat(scoreMatch[1]);
            userScore += iaScore; 
            console.log("Score IA extrait pour paragraphe:", iaScore);
        } else {
             console.warn("L'IA n'a pas retourné une note lisible dans le format 'Note: X/10'. Score non ajouté au total.");
        }
        
        resultDiv.innerHTML = `<div class="ia-feedback">${responseText}</div>`;
        document.getElementById('next-question-btn').style.display = 'block';

    } catch (error) {
        console.error("Erreur lors de la correction:", error);
        resultDiv.innerHTML = `<p class="error">❌ Erreur de connexion à l'IA lors de la correction.
            Détails: ${error.message}. <br>
            Vérifiez l'URL de votre serveur Render et les logs de votre backend.
        </p>`;
    }
}

function submitDictation() {
    console.log("submitDictation() déclenché.");
    const questionData = currentQuizData[currentQuestionIndex];
    const userAnswer = document.getElementById('dictation-answer').value.trim();
    const resultDiv = document.getElementById('correction-feedback');
    const dictationPoints = questionData.points && typeof questionData.points === 'number' ? questionData.points : 1;

    if (currentAudioPlayer) {
        currentAudioPlayer.pause();
        currentAudioPlayer.currentTime = 0;
    }
    document.getElementById('dictation-answer').disabled = true;
    document.getElementById('play-audio-btn').disabled = true;

    const originalText = questionData.text;

    const normalizedUserAnswer = userAnswer.toLowerCase().replace(/[.,!?;:']/g, '').replace(/\s+/g, ' ').trim(); 
    const normalizedOriginalText = originalText.toLowerCase().replace(/[.,!?;:']/g, '').replace(/\s+/g, ' ').trim();

    let score = 0;
    let feedback = '';

    if (normalizedUserAnswer === normalizedOriginalText) {
        score = dictationPoints;
        feedback = `<p class="correct">✅ **Excellent !** Votre transcription est parfaite. Vous gagnez ${score} points.</p>`;
    } else {
        feedback = `<p class="incorrect">❌ **Votre transcription contient des erreurs.**</p>`;
        feedback += `<p>Texte attendu : "**${originalText}**"</p>`;
        feedback += `<p>Votre réponse : "${userAnswer}"</p>`;
    }
    
    userScore += score;
    resultDiv.innerHTML = feedback;
    document.getElementById('next-question-btn').style.display = 'block';
}


// --- Navigation ---

function nextQuestion() {
    console.log("Passage à la question suivante.");
    document.getElementById('correction-feedback').innerHTML = '';
    document.getElementById('next-question-btn').style.display = 'none';

    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuizData.length) {
        displayCurrentQuestion();
    } else {
        showFinalScore();
    }
}

function showFinalScore() {
    console.log("Fin du quiz. Score utilisateur:", userScore, "Total points possibles:", totalQuizPoints);
    let feedback = `<h2>🎉 Quiz terminé !</h2>`;
    
    if (totalQuizPoints > 0) {
        const finalNote = (userScore / totalQuizPoints) * 20; 
        const finalNoteRounded = finalNote.toFixed(2);
        
        feedback += `<p>Votre performance globale est de **${userScore.toFixed(2)} / ${totalQuizPoints} points**.</p>`;
        feedback += `<h3>Votre note estimée sur 20 est : **${finalNoteRounded} / 20**</h3>`;
    } else {
         feedback += `<p>Ce quiz ne contenait que des sujets de rédaction dont le score n'a pas pu être extrait pour le calcul final et/ou des erreurs empêchant un calcul total.</p>`;
    }

    document.getElementById('question-container').innerHTML = feedback + '<button onclick="window.location.reload()">Recommencer</button>';
    isQuizRunning = false;
}
