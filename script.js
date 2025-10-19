// script.js (Version complète mise à jour pour fonctionner avec le serveur proxy OpenAI)

// --- FONCTIONS DE DÉBOGAGE PERSONNALISÉES ---
// (Les fonctions de logging restent inchangées et sont critiques pour le débogage)

// CHANGEMENT CRITIQUE 1 : Déclaré avec 'let' et initialisé à null pour être affecté plus tard
let debugElement = null; 

const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const VERSION_INFO = "v15 - Correction Cold Start et Logs - 11/10/2025 à 18:19"; 

// Les appels console.info sont maintenant DÉPLACÉS dans le bloc DOMContentLoaded !

function appendToDebug(message, type = 'log') {
    // La vérification est CRITIQUE (elle ne passe que si l'élément a été trouvé dans DOMContentLoaded)
    if (debugElement) {
        const p = document.createElement('p');
        p.style.whiteSpace = 'pre-wrap';
        p.textContent = `[${type.toUpperCase()}] ${new Date().toLocaleTimeString()} : ${message}`;
        if (type === 'error') {
            p.style.color = '#ff6b6b';
        } else if (type === 'warn') {
            p.style.color = '#ffe082';
        } else if (type === 'info') {
            p.style.color = '#aed7ff';
        } else {
            p.style.color = 'yellow';
        }
        if (debugElement.firstChild) {
            debugElement.insertBefore(p, debugElement.firstChild);
        } else {
            debugElement.appendChild(p);
        }
        while (debugElement.childElementCount > 50) {
            debugElement.removeChild(debugElement.lastChild);
        }
    }
}

// --- FONCTIONS UTILITAIRES POUR L'INTERFACE ET LE CHARGEMENT ---

/**
 * Affiche ou masque l'état de chargement dans le pied de page du quiz.
 * @param {boolean} isLoading - True pour afficher, False pour masquer.
 */
function showLoading(isLoading) {
    const feedbackDiv = document.getElementById('ai-generation-feedback');
    
    // Si la génération est terminée (isLoading = false), on vide le message.
    if (!isLoading) {
        feedbackDiv.innerHTML = '';
    } 
    // Note : Le message de chargement détaillé est déjà géré par startQuiz,
    // donc cette fonction sert principalement de drapeau d'état pour la fin.
}

/**
 * Affiche un message d'erreur dans l'interface et dans la console de débogage.
 * @param {string} message - Le message d'erreur à afficher.
 */
function showError(message) {
    const feedbackDiv = document.getElementById('ai-generation-feedback');
    
    // Affichage dans le feedback box
    feedbackDiv.innerHTML = `<p class="error" style="color: #dc3545; font-weight: bold;">🚨 ERREUR : ${message}</p>`;

    // Si la fonction appendToDebug existe, on l'utilise
    if (typeof appendToDebug === 'function') {
        appendToDebug(`[AFFICHAGE UTILISATEUR] ${message}`, 'error');
    }
}

/**
 * Fonction utilitaire pour créer un délai (utilisée pour simuler le cold start).
 * @param {number} ms - Le temps de pause en millisecondes.
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

console.log = function(...args) {
    originalConsoleLog.apply(console, args); 
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    appendToDebug(message, 'log');
};
console.warn = function(...args) {
    originalConsoleWarn.apply(console, args); 
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    appendToDebug(message, 'warn');
};
console.error = function(...args) {
    originalConsoleError.apply(console, args); 
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    appendToDebug(message, 'error');
};

// ... (le reste du code, comme les variables globales, ne change pas jusqu'à DOMContentLoaded)
console.log("script.js chargé. Logging personnalisé actif.");

// --- Variables Globales ---
const MATIERES_BASE_PATH = 'matieres';
let selectedItems = []; 
let currentQuizData = []; 
let currentQuestionIndex = 0;
let totalQuizPoints = 0; 
let userScore = 0; 
let isQuizRunning = false;

// REMPLACER PAR L'URL DE VOTRE SERVEUR RENDER
const BASE_API_URL = 'https://cle-api.onrender.com';
const CORRECTION_API_URL = `${BASE_API_URL}/correction`;
const GENERATION_API_URL = `${BASE_API_URL}/generate`; // <-- CORRECTION ICI !
const TTS_API_URL = `${BASE_API_URL}/tts`; 
// --- NOUVELLES CONSTANTES POUR LE SCORING ---
const TARGET_QUIZ_POINTS = 20;
const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 10;
// ---------------------------------------------

console.log(`URL de l'API Backend: ${BASE_API_URL}`);

const QUIZ_API_ENDPOINT = 'https://cle-api.onrender.com/generate';
async function fetchQuizData(subject) {
    console.log(`Début de la génération du quiz pour le sujet: ${subject}`);
    showLoading(true);
    
    // Le prompt 'system' définit le comportement de l'IA.
    const systemPrompt = `Vous êtes un générateur de quiz d'histoire et de géographie pour des élèves de 3e. Votre réponse DOIT être uniquement un tableau JSON, SANS aucun texte d'introduction ou d'explication. Le tableau doit contenir 5 objets QuizQuestion, chaque objet ayant la structure suivante : { type: string (soit 'mcq' pour choix multiple, soit 'short_answer' pour réponse courte, soit 'long_answer' pour rédaction), question: string, options: array (liste des choix pour mcq, vide pour short_answer/long_answer), answer: string (la bonne réponse), explanation: string (explication courte), maxPoints: number (points maximum pour la question, 1 pour mcq/short_answer, 5 pour long_answer) }.`;
    
    // Le prompt 'user' définit la tâche spécifique.
    const userPrompt = `Générer un quiz de 5 questions sur le thème: "${subject}". Le quiz doit contenir 2 questions à choix multiples (mcq), 2 questions à réponse courte (short_answer), et 1 question de rédaction (long_answer).`;
    
    // Structure de l'objet à envoyer, compatible avec le server.js
    const payload = {
        prompt: {
            system: systemPrompt,
            user: userPrompt
        }
    };
    
    try {
        const response = await fetch(QUIZ_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload) // Envoi du payload structuré
        });

        if (response.status === 429) {
            console.error('Erreur 429: Limite de débit atteinte pour toutes les clés API. Veuillez réessayer dans 30 minutes.');
            showError('Limite de débit atteinte pour toutes les clés API. Veuillez réessayer dans 30 minutes.');
            return null;
        }

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Erreur API:', response.status, errorData.error);
            showError(`Erreur du serveur proxy : ${errorData.details || errorData.error || response.statusText}.`);
            return null;
        }

        // ... Le reste de la fonction reste inchangé : traitement et parsing JSON de la réponse API
        const data = await response.json();
        
        // Extraction du texte de la réponse (qui devrait être le JSON brut)
        const jsonText = data.choices[0].message.content.trim();
        
        // ... (suite de la fonction pour le parsing et l'affichage) ...

        // Tentative de nettoyer le JSON (si l'IA a mis des balises comme ```json)
        const cleanedJsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');

        // Parsing du JSON pour obtenir le tableau de questions
        const quizData = JSON.parse(cleanedJsonText);
        
        return quizData;

    } catch (error) {
        console.error('Erreur fatale lors de la communication avec le serveur ou du traitement JSON:', error);
        showError('Impossible de contacter le serveur ou de lire la réponse. Vérifiez le log du serveur et l\'URL.');
        return null;
    } finally {
        showLoading(false);
    }
}

const STRUCTURE = {
    // CORRECTION CLÉ : Pas d'accent dans Mathematiques
    "Mathematiques": {
        "T1_STATISTIQUES": [
            { name: "Statistiques", file: "Mathematiques/T1_STATISTIQUES/Statistiques.txt", type: "qcm" }
        ],
        "G1-Triangles et proportionnalité": [
            { name: "Triangles et proportionnalité", file: "Mathematiques/G1-Triangles et proportionnalité/Triangles et proportionnalité.txt", type: "qcm" },
            { name: "Les aires", file: "Mathematiques/G1-Triangles et proportionnalité/Les aires.txt", type: "qcm" }
        ]
    },
    "Francais": {
        "Écriture": [
            { name: "Qui est je", file: "Francais/Écriture/Qui est je.txt", type: "paragraphe" },
            { name: "Autoportrait", file: "Francais/Écriture/Autoportrait.txt", type: "paragraphe" }
        ],
        "Analyse": [
            { name: "Analyse d'un texte", file: "Francais/Analyse/Analyse d'un texte .txt", type: "paragraphe" }
        ],
        "Conjugaison": [
             { name: "Le Présent (Indicatif)", file: "Francais/Conjugaison/Le Présent (Indicatif).txt", type: "dictation" }
        ]
    },
    // CORRECTION CLÉ : Anglais avec A majuscule
    "Anglais": {
        "Culture": [
            { name: "Les pays anglophones", file: "Anglais/Culture/Les pays anglophones.txt", type: "qcm" }
        ]
    },
    "Histoire_Geo": { // CLÉ : Avec underscore
        "Histoire": [
            { name: "1er-Guerre-Mondiale", file: "Histoire_Geo/Histoire/1er-Guerre-Mondiale.txt", type: "mixte" }
        ]
    },
    "Science-de-la-Vie-et-de-la-Terre": {
        "Biologie": [
            { name: "Le programme génétique", file: "Science-de-la-Vie-et-de-la-Terre/Biologie/Le programme génétique.txt", type: "mixte" },
            { name: "L'Hérédité (Génétique)", file: "Science-de-la-Vie-et-de-la-Terre/Biologie/L'Hérédité (Génétique).txt", type: "mixte" }
        ]
    },
    // CLÉ : technologie en minuscules
    "technologie": {
        "Systèmes": [
            { name: "Les systèmes automatisés", file: "technologie/Systèmes/Les systèmes automatisés.txt", type: "mixte" }
        ]
    },
    "Physique-Chimie": {
        "Chimie": [
            { name: "Atomes et Tableau Périodique", file: "Physique-Chimie/Chimie/Atomes et Tableau Périodique.txt", type: "mixte" }
        ]
    },
    "Art-Plastiques": {
        "Méthodologie": [
            { name: "Analyser une œuvre d'art", file: "Art-Plastiques/Méthodologie/Méthode pour analyser une œuvre d'art.txt", type: "paragraphe" }
        ]
    },
    "musique": {
        "Histoire": [
            { name: "Chanson engagée", file: "musique/Histoire/Chanson engagée.txt", type: "paragraphe" }
        ]
    }
};

// Début du fichier script (14).js

// (Vos variables globales comme debugElement, originalConsoleLog, VERSION_INFO...)

// --- DÉBUT DU BLOC UNIQUE DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. INITIALISATION DE L'ÉLÉMENT DE DÉBOGAGE
    debugElement = document.getElementById('debug');
    
    // 2. AFFICHAGE DES LOGS DE VERSION DANS LA CONSOLE
    if (debugElement) {
        console.info(`[VERSION] Déploiement actif : ${VERSION_INFO}`);
        console.info(`[RENDER] API de génération : ${GENERATION_API_URL}`);
        console.log("script.js chargé. Logging personnalisé actif.");
    }

    // 3. RENDU DU MENU (DOIT ÊTRE FAIT AVANT D'ASSOCIER LES ÉCOUTEURS DE CLIC)
    renderMenu();

    // 4. ASSOCIATION DES BOUTONS DE DÉMARRAGE (LA VRAIE CORRECTION)
    console.log("Configuration des boutons de quiz...");
    // 🚨 NOUVEAU LOG DE CONTRÔLE CRITIQUE
    console.log("--- Démarrage de la vérification des IDs de boutons ---"); 

    // --- Mixte ---
    const mixteBtn = document.getElementById('start-mixte-quiz-btn');
    if (mixteBtn) {
        console.log("✅ ID TROUVÉ: start-mixte-quiz-btn. Attachement de l'écouteur.");
        mixteBtn.addEventListener('click', () => {
            console.log("🔥 Clic Intercepté: Démarrage du Quiz 'mixte'."); 
            startQuiz('mixte'); 
        });
    } else {
        console.error("❌ ID MANQUANT: start-mixte-quiz-btn. Vérifiez l'ID dans votre HTML.");
    }

    // --- QCM ---
    const qcmBtn = document.getElementById('start-qcm-btn');
    if (qcmBtn) {
        console.log("✅ ID TROUVÉ: start-qcm-btn. Attachement de l'écouteur.");
        qcmBtn.addEventListener('click', () => {
            console.log("🔥 Clic Intercepté: Démarrage du Quiz 'qcm'."); 
            startQuiz('qcm'); 
        });
    } else {
        console.error("❌ ID MANQUANT: start-qcm-btn. Vérifiez l'ID dans votre HTML.");
    }

    // --- Paragraphe ---
    const paragrapheBtn = document.getElementById('start-paragraphe-btn');
    if (paragrapheBtn) {
        console.log("✅ ID TROUVÉ: start-paragraphe-btn. Attachement de l'écouteur.");
        paragrapheBtn.addEventListener('click', () => {
            console.log("🔥 Clic Intercepté: Démarrage du Quiz 'paragraphe'."); 
            startQuiz('paragraphe'); 
        });
    } else {
        console.error("❌ ID MANQUANT: start-paragraphe-btn. Vérifiez l'ID dans votre HTML.");
    }

    // --- Dictée ---
    const dictationBtn = document.getElementById('start-dictation-btn');
    if (dictationBtn) {
        console.log("✅ ID TROUVÉ: start-dictation-btn. Attachement de l'écouteur.");
        dictationBtn.addEventListener('click', () => {
            console.log("🔥 Clic Intercepté: Démarrage du Quiz 'dictation'."); 
            startQuiz('dictation'); 
        });
    } else {
        console.error("❌ ID MANQUANT: start-dictation-btn. Vérifiez l'ID dans votre HTML.");
    }

    // --- Trouver l'Erreur ---
    const spotErrorBtn = document.getElementById('start-spot-error-btn');
    if (spotErrorBtn) {
        console.log("✅ ID TROUVÉ: start-spot-error-btn. Attachement de l'écouteur.");
        spotErrorBtn.addEventListener('click', () => {
            console.log("🔥 Clic Intercepté: Démarrage du Quiz 'spot_error'."); 
            startQuiz('spot_error'); 
        });
    } else {
        console.error("❌ ID MANQUANT: start-spot-error-btn. Vérifiez l'ID dans votre HTML.");
    }
    
    // 5. AUTRES BOUTONS ET MISE À JOUR INITIALE
    // Le bouton "Question Suivante"
    document.getElementById('next-question-btn').addEventListener('click', nextQuestion);

    // Mise à jour de l'état initial
    updateSelectedBox();
    //updateStartButtonsVisibility(); // Cette fonction est CRITIQUE !
});
function renderMenu() {
    const menuContainer = document.getElementById('menu-container');
    let html = '';
    for (const matiere in STRUCTURE) {
        html += `<div class="matiere"><h2>${matiere}</h2>`;
        for (const subMatiere in STRUCTURE[matiere]) {
            html += `<div class="sub-matiere"><h3>${subMatiere}</h3><ul>`;
            STRUCTURE[matiere][subMatiere].forEach(item => {
                const path = getItemPath(matiere, subMatiere, item);
                const isSelected = selectedItems.some(sel => sel.path === path);
                html += `
                    <li>
                        <label>
                            <input 
                                type="checkbox" 
                                data-path="${path}" 
                                data-name="${item.name}" 
                                onchange="toggleSelection(this)" // <-- Rétablir cet appel !
                                ${isSelected ? 'checked' : ''}
                            >
                            ${item.name} (${item.type || 'Fichier'})
                        </label>
                    </li>
                `;
            });
            html += `</ul></div>`;
        }
        html += `</div>`;
    }
    menuContainer.innerHTML = html;
    // La fonction updateSelectedBox() doit être appelée ici après le chargement du menu.
    updateSelectedBox(); 
}
// ... (Vos variables globales comme currentQuizData, selectedItems, etc.)

/**
 * Vérifie la réponse pour une question à choix multiples (QCM) ou Vrai/Faux.
 * Met à jour le score de l'utilisateur et affiche la correction.
 */
function checkQCMAnswer() {
    const currentQuestion = currentQuizData[currentQuestionIndex];
    const correctionFeedbackDiv = document.getElementById('correction-feedback');
    const questionType = currentQuestion.type ? currentQuestion.type.toLowerCase() : '';

    // Détermine le nom de l'élément HTML (QCM ou Vrai/Faux)
    const radioName = (questionType === 'qcm' || questionType === 'mcq') ? 'qcm_answer' : 'vrai_faux_answer';
    
    // Récupère l'option sélectionnée par l'utilisateur
    const selectedRadio = document.querySelector(`input[name="${radioName}"]:checked`);
    
    if (!selectedRadio) {
        alert("Veuillez sélectionner une option avant de valider la réponse !");
        return;
    }
    
    const userAnswer = selectedRadio.value;
    const correctAnswer = currentQuestion.answer;
    const maxPoints = currentQuestion.maxPoints || 1;
    let feedbackHTML = '';
    let isCorrect = false;

    // Comparaison de la réponse
    if (userAnswer.trim() === correctAnswer.trim()) {
        isCorrect = true;
        userScore += maxPoints;
        feedbackHTML = `<p class="alert-success">✅ **Bonne réponse !** Vous gagnez ${maxPoints} point(s).</p>`;
    } else {
        feedbackHTML = `<p class="alert-danger">❌ **Mauvaise réponse.** Vous ne gagnez aucun point.</p>`;
    }

    // Affichage de la correction
    feedbackHTML += `<p>La bonne réponse était : **${correctAnswer}**.</p>`;
    feedbackHTML += `<p>Explication : ${currentQuestion.explanation || "Aucune explication fournie par l'IA."}</p>`;

    correctionFeedbackDiv.innerHTML = feedbackHTML;
    
    // Désactiver tous les boutons radio après la validation pour éviter de changer la réponse
    document.querySelectorAll(`input[name="${radioName}"]`).forEach(radio => {
        radio.disabled = true;
        // Met en évidence la bonne réponse
        if (radio.value === correctAnswer) {
            radio.parentElement.style.fontWeight = 'bold';
            radio.parentElement.style.color = 'green';
        }
    });

    // Masque le bouton de validation et affiche le bouton "Question Suivante"
    const validateButton = document.querySelector(`div.${questionType}-question button`);
    if (validateButton) validateButton.style.display = 'none';

    document.getElementById('next-question-btn').style.display = 'block';
}

// --- NOUVELLE FONCTION : GESTION DE L'INTERFACE DE DÉMARRAGE ---
function updateStartButtonsVisibility() {
    // Vérifie si le tableau des sujets sélectionnés n'est pas vide
    const isItemSelected = selectedItems.length > 0; 
    
    // Sélectionne tous les boutons qui ont la classe 'start-btn'
    const startButtons = document.querySelectorAll('.start-btn'); 
    
    // Met à jour l'attribut 'disabled' et l'opacité pour le feedback visuel
    startButtons.forEach(button => {
        button.disabled = !isItemSelected; 
        button.style.opacity = isItemSelected ? 1.0 : 0.5;
    });

    // Mise à jour de la boîte de sélection visuelle
    document.getElementById('selected-box').style.backgroundColor = isItemSelected ? '#d4edda' : '#e9ecef'; // Couleur verte si sélectionné
    document.getElementById('selected-items').textContent = isItemSelected ? selectedItems.map(i => i.name).join(', ') : 'Aucun sujet sélectionné.';
}

// ... (Le reste de vos fonctions comme startQuiz, displayCurrentQuestion, etc.)

function getItemPath(matiere, subMatiere, item) {
    // CORRECTION : On utilise SIMPLEMENT la valeur déjà formatée dans item.file
    // Elle contient déjà : "Anglais/Culture/Les pays anglophones.txt"
    return item.file;
}

// --- Nouvelle Fonction : GESTION DU STYLE ET DES DONNÉES ---

function toggleSelection(checkbox) {
    console.log("toggleSelection exécutée pour:", checkbox.dataset.name, "Checked:", checkbox.checked);
    // 1. GÉRER LE STYLE VISUEL (Corrige le problème de couleur/bouton "pas normal")
    // Trouve l'élément <li> parent le plus proche, où la classe 'selected' est appliquée
    const listItem = checkbox.closest('li');
    
    if (listItem) {
        // Applique ou retire la classe 'selected' pour changer la couleur du fond
        if (checkbox.checked) {
            listItem.classList.add('selected');
        } else {
            listItem.classList.remove('selected');
        }
    }

    // 2. GÉRER LES DONNÉES (Ceci est la correction du bug initial "Veuillez choisir un sujet")
    // Elle appelle la fonction qui lit le DOM et remplit le tableau 'selectedItems'.
    updateSelectedBox(); 
}

// Variable globale (assurez-vous que cette ligne est en haut du script)
// DANS script.js
// Assurez-vous que 'selectedItems' est déclaré globalement : let selectedItems = [];

function updateSelectedBox() {
    // 1. Lire toutes les checkboxes COCHÉES sur la page
    const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
    
    // 2. Vider et remplir le tableau global 'selectedItems'
    selectedItems = [];
    const selectedNames = [];

    checkboxes.forEach(checkbox => {
        // Ces data-attributs sont CRITIQUES. Ils doivent être présents sur vos checkboxes.
        const path = checkbox.dataset.path; 
        const name = checkbox.dataset.name; 

        if (path && name) {
            // Remplir le tableau global qui est vérifié par startQuiz
            selectedItems.push({ path: path, name: name });
            selectedNames.push(name);
        }
    });

    // 3. Mettre à jour l'affichage dans la boîte de sélection
    const selectedItemsSpan = document.getElementById('selected-items');
    if (selectedNames.length > 0) {
        selectedItemsSpan.innerHTML = selectedNames.map(item => `<b>${item}</b>`).join(', ');
    } else {
        selectedItemsSpan.textContent = 'Aucun sujet sélectionné.';
    }
    
    console.info("Sélection mise à jour. Total:", selectedItems.length);
}
// --- FONCTION DE RÉCUPÉRATION DU CONTENU RÉEL DES FICHIERS ---
async function fetchContent(path) {
    // path est maintenant le chemin complet de la STRUCTURE (ex: "Mathematiques/T1_STATISTIQUES/Statistiques.txt")
    
    // CORRECTION CLÉ : On n'utilise plus de substring !
    const fullPath = `matieres/${path}`; // 👈 C'EST LA LIGNE CORRECTE
    console.log(`Tentative de chargement du fichier : ${fullPath}`);
    
    try {
        const response = await fetch(fullPath);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status} pour le fichier ${fullPath}`);
        }
        // Récupère le contenu brut du fichier texte
        const content = await response.text(); 
        return content;
        
    } catch (error) {
        console.error(`Échec du chargement du fichier ${fullPath}:`, error);
        // Afficher l'erreur dans la console de debug de la page
        document.getElementById('ai-generation-feedback').innerHTML = `<p class="error">❌ Échec du chargement : ${fullPath}</p>`;
        return null; // Retourne null si le chargement échoue
    }
}

function parseMarkdown(text) {
    if (typeof text !== 'string') return text;
    // Remplace **texte** par <span class="bold-underline">texte</span>
    return text.replace(/\*\*(.*?)\*\*/g, '<span style="font-weight: bold; text-decoration: underline;">$1</span>');
}


// --- LOGIQUE DE GÉNÉRATION ET DÉMARRAGE ---
// Définition des constantes pour le nombre de questions
async function startQuiz(quizType = 'mixte') {
    console.log(`[START] Fonction startQuiz() lancée pour le type : ${quizType}`);
    // ----------------------------------------------------------------------
    // ÉTAPE 1 : INITIALISATION ET VÉRIFICATION
    // ----------------------------------------------------------------------

    // Masquer la vue de sélection et afficher la vue du quiz
    document.getElementById('selection-view').style.display = 'none';
    
    // NOUVELLE LIGNE CRITIQUE : Masquer la zone des boutons de démarrage
    document.getElementById('start-buttons').style.display = 'none'; 
    
    document.getElementById('quiz-view').style.display = 'block';
    if (selectedItems.length === 0) {
        // Log en cas d'échec critique : aucun sujet sélectionné
        console.error("[START] ÉCHEC: Aucun sujet sélectionné. Retour au menu.");
        alert("Veuillez sélectionner au moins un sujet de révision.");
        return;
    }
    
    // Log de succès avant le chargement (cela confirme que nous allons bien continuer)
    console.log(`[START] SUCCÈS: ${selectedItems.length} sujet(s) sélectionné(s). Début du chargement des fichiers.`);

    
    // Réinitialisation de toutes les données de la session précédente
    currentQuizData = [];
    currentQuestionIndex = 0;
    userScore = 0;
    totalQuizPoints = 0;
    isQuizRunning = true; 
    
    // Affichage immédiat du message de chargement
    document.getElementById('quiz-view').style.display = 'block';
    document.getElementById('selection-view').style.display = 'none';

    document.getElementById('question-container').innerHTML = `
        <h2 style="color: #007bff;">⏳ Préparation et Génération du Quiz...</h2>
        <p class="loading-message">Chargement des fichiers et contact avec le serveur IA.</p>
    `;
    const feedbackDiv = document.getElementById('ai-generation-feedback');
    feedbackDiv.innerHTML = '<p class="info">Chargement des fichiers...</p>'; 

    
    // ----------------------------------------------------------------------
    // ÉTAPE 2 : PRÉPARATION (CHARGEMENT ET CONCATÉNATION DE TOUT LE CONTENU)
    // ----------------------------------------------------------------------
    const loadedContents = [];
    let allContent = ""; // <-- NOUVEAU : Contient tout le texte à envoyer à l'IA
    
    for (const item of selectedItems) {
        if (quizType === 'dictation') {
            await generateDictationQuestion(item.path); 
            break; // Sort de la boucle si c'est une dictée
        }
        
        // On charge le contenu de chaque fichier sélectionné
        const content = await fetchContent(item.path); 
        if (content) {
            loadedContents.push({ content: content, name: item.name });
            allContent += `--- Contenu de ${item.name} ---\n${content}\n\n`; // CONCATÉNATION
            feedbackDiv.innerHTML = `<p class="info">Fichier pour **${item.name}** chargé.</p>`;
        }
    }
    
    if (loadedContents.length === 0 && quizType !== 'dictation') {
        isQuizRunning = false;
        alert("Aucun contenu de révision n'a pu être chargé. Vérifiez vos fichiers.");
        document.getElementById('quiz-view').style.display = 'none';
        document.getElementById('selection-view').style.display = 'block';
        return;
    }
    
    if (quizType === 'dictation') {
        feedbackDiv.innerHTML = '';
        isQuizRunning = false;
        if (currentQuizData.length > 0) displayCurrentQuestion();
        return;
    }


    // ----------------------------------------------------------------------
    // ÉTAPE 3 : GÉNÉRATION EN UN SEUL APPEL (RAPIDE)
    // ----------------------------------------------------------------------
    
    // Détermine le nombre de questions à générer aléatoirement (entre MIN et MAX)
    const questionsToGenerate = Math.floor(Math.random() * (MAX_QUESTIONS - MIN_QUESTIONS + 1)) + MIN_QUESTIONS;
    
    // --- GESTION DU COLD START UNIQUE ---
    feedbackDiv.innerHTML = `<p class="warn">⏸️ Initialisation du serveur Render (Cold Start)...</p>`;
    await delay(1500); // Délai d'attente unique pour le cold start
    
    feedbackDiv.innerHTML = `<p class="info">⏳ Contact de l'IA pour générer le quiz complet (**${questionsToGenerate}** questions)...</p>`;

    // Appel unique en envoyant TOUT le contenu et le nombre de questions
    const questionsArray = await generateRandomQuestionFromContent(
        allContent, 
        quizType, 
        selectedItems.map(i => i.name).join(', '),
        questionsToGenerate 
    );
    
    // ----------------------------------------------------------------------
    // ÉTAPE 4 : AFFICHAGE FINAL
    // ----------------------------------------------------------------------
    isQuizRunning = false; 
    feedbackDiv.innerHTML = ''; 

// ... dans l'Étape 4 de votre startQuiz ...

if (questionsArray && questionsArray.length > 0) {
    // Le quiz est généré en une seule fois
    currentQuizData = questionsArray;
    
    // 🚨 AJOUTEZ CETTE LIGNE : Calcule le score total en additionnant les maxPoints de chaque question
    totalQuizPoints = currentQuizData.reduce((sum, q) => sum + (q.maxPoints || 1), 0);
    console.log(`Score total possible pour le quiz: ${totalQuizPoints} points.`);
    
    displayCurrentQuestion();
    } else {
        // En cas d'échec de la génération
        alert("L'IA n'a pu générer aucune question. Vérifiez votre serveur Render et votre connexion.");
        document.getElementById('quiz-view').style.display = 'none';
        document.getElementById('selection-view').style.display = 'block';
    }
}
    
/**
 * Génère un ensemble complet de questions via un seul appel à l'API,
 * en demandant un tableau JSON contenant toutes les questions requises.
 * @param {string} sourceContent - Le contenu de révision CONCATÉNÉ de tous les sujets sélectionnés.
 * @param {string} quizType - Le type de quiz (mixte, qcm, paragraphe, etc.) pour guider l'IA.
 * @param {string} sourceNames - La liste des noms de sujets séparés par des virgules pour le contexte.
 * @param {number} numberOfQuestions - Le nombre total de questions à générer.
 * @returns {Array<Object>|null} Le tableau de questions complètes ou null en cas d'erreur.
 */
async function generateRandomQuestionFromContent(sourceContent, quizType, sourceNames, numberOfQuestions) {
    console.log(`Début de la génération de ${numberOfQuestions} questions de type ${quizType} pour le(s) sujet(s) : ${sourceNames}`);
    showLoading(true);

    // --- 1. Définition des prompts ---

    // La ligne corrigée est ici (utilisation de \`\`\`json pour l'échappement)
    const systemPrompt = `Vous êtes un générateur de quiz pour des élèves de 3e. Votre réponse DOIT être UNIQUEMENT un tableau JSON (format JSON array) de ${numberOfQuestions} objets QuizQuestion, SANS aucun texte, commentaire, ou explication autour (pas de balises \`\`\`json). Notez les questions comme au brevet. La structure de chaque objet QuizQuestion DOIT être : { type: string ('mcq', 'short_answer', ou 'long_answer'), question: string, options: array (liste des choix pour mcq, vide sinon), answer: string (la bonne réponse), explanation: string (explication courte), maxPoints: number (points pour la question, 1 pour QCM/courte, 5 ou 10 pour rédaction) }.`;

    // Le prompt 'user' définit la tâche spécifique (sujets + nombre de questions + contenu)
    let userPrompt = `En utilisant ce contenu de révision : 
--- CONTENU DE RÉVISION ---
${sourceContent}
--- FIN DU CONTENU ---
Générer un quiz complet de ${numberOfQuestions} questions de type "${quizType}" sur le(s) thème(s) suivant(s): "${sourceNames}".`;

    if (quizType === 'qcm') {
        userPrompt += " Toutes les questions doivent être à choix multiples (mcq), valant 1 point chacune, avec 4 options de réponse.";
    } else if (quizType === 'paragraphe_ia') {
        userPrompt += " Toutes les questions doivent être des questions de rédaction (long_answer), valant 10 points chacune.";
    } else if (quizType === 'mixte') {
        userPrompt += " Le quiz doit contenir un mélange équilibré de questions à choix multiples (mcq), à réponse courte (short_answer) et de rédaction (long_answer).";
    }

    // --- 2. Construction du Payload pour le Proxy ---
    const payload = {
        prompt: {
            system: systemPrompt,
            user: userPrompt
        },
        model: "gpt-4o-mini"
    };

    // --- 3. Appel à l'API ---
    try {
        const response = await fetch(GENERATION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Réponse non-JSON du serveur proxy.', details: response.statusText }));
            console.error('Erreur API Génération:', response.status, JSON.stringify(errorData));
            showError(`Erreur du serveur proxy (${response.status}) : ${errorData.details || errorData.error || response.statusText}.`);
            return null;
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
            console.error('Structure de réponse OpenAI invalide:', data);
            showError(`L'API a répondu, mais la structure du quiz est invalide.`);
            return null;
        }

        const jsonText = data.choices[0].message.content.trim();
        // Nettoyage des balises JSON si l'IA les a ajoutées
        const cleanedJsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');

        // Parsing du JSON pour obtenir le tableau de questions
        const quizData = JSON.parse(cleanedJsonText);

        console.log(`Quiz généré avec succès. Nombre de questions: ${quizData.length}`);
        return quizData; // Renvoie le tableau complet

    } catch (error) {
        console.error('Erreur fatale lors de la communication ou du traitement JSON:', error);
        showError('Impossible de contacter le serveur ou de lire la réponse (Erreur réseau/JSON).');
        return null;
    } finally {
        showLoading(false);
    }
}

/**
 * Vérifie la réponse pour les questions à réponse courte ou longue.
 * Met à jour le score et affiche l'explication.
 */
function checkFreeTextAnswer() {
    const currentQuestion = currentQuizData[currentQuestionIndex];
    const correctionFeedbackDiv = document.getElementById('correction-feedback');
    const answerElement = document.getElementById('answer-box');
    
    if (!answerElement || answerElement.value.trim() === '') {
        alert("Veuillez saisir votre réponse.");
        return;
    }

    const userAnswer = answerElement.value.trim();
    const correctAnswer = currentQuestion.answer;
    const maxPoints = currentQuestion.maxPoints || 1;
    let feedbackHTML = '';

    // Pour l'instant, on ne fait que comparer la présence de mots-clés ou on montre la réponse
    
    feedbackHTML += `<p class="alert-info">ℹ️ **Réponse Attendue :** ${parseMarkdown(correctAnswer)}</p>`;
    feedbackHTML += `<p>Explication : ${currentQuestion.explanation || "Aucune explication fournie par l'IA."}</p>`;
    feedbackHTML += `<p class="alert-warning">💡 **Auto-Correction :** Pour ce type de question, vous devez vous auto-évaluer sur la base de la réponse attendue et de l'explication. Points possibles : ${maxPoints}.</p>`;

    // Option : Vous pouvez ajouter ici un bouton pour attribuer les points manuellement.
    // Pour l'instant, on n'ajoute pas de score automatiquement pour ces questions.
    
    correctionFeedbackDiv.innerHTML = feedbackHTML;
    
    // Désactiver la zone de texte
    answerElement.disabled = true;

    // Masquer le bouton de validation et afficher le bouton "Question Suivante"
    const validateButton = document.querySelector('.paragraphe-sujet button');
    if (validateButton) validateButton.style.display = 'none';

    document.getElementById('next-question-btn').style.display = 'block';
}

// NOTE : Vous n'avez pas besoin de la fonction checkAnswer() (l'ancienne) si vous utilisez checkQCMAnswer() et checkFreeTextAnswer(). Vous pouvez la supprimer pour éviter la confusion.

async function generateDictationQuestion(path) {
    const generationFeedbackDiv = document.getElementById('ai-generation-feedback');
    generationFeedbackDiv.innerHTML = '<p class="info">⏳ Préparation de la dictée...</p>';
    
    const content = await fetchContent(path);
    
    // 1. Demander à l'IA de synthétiser le texte en une courte dictée
    const systemPrompt = `À partir de la leçon, générez un court texte (maximum 40 mots) sous forme de dictée pour un élève de 3e. Ne donnez que le texte de la dictée, sans ponctuation finale.`;
    const userPrompt = `Contenu de la leçon:\n---\n${content}\n---\nTexte de la dictée :`;
    
    try {
        const response = await fetch(GENERATION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemPrompt, userPrompt, model: "gpt-4o-mini" }) 
        });

        const aiData = await response.json();
        const dictationText = aiData.generated_content ? aiData.generated_content.trim().replace(/['"«»]/g, '') : null;
        
        if (!dictationText || aiData.error) {
             throw new Error(aiData.error ? aiData.error.details : "Texte de dictée vide.");
        }

        // 2. Afficher la question de dictée
        currentQuizData.push({ type: 'dictation', text: dictationText, sourceName: path });
        displayCurrentQuestion();

        // 3. Demander à l'IA de générer l'audio (TTS)
        await generateAndPlayTTS(dictationText);

    } catch (error) {
        console.error("Erreur lors de la préparation de la dictée:", error);
        generationFeedbackDiv.innerHTML = `<p class="error">❌ Erreur lors de la préparation de la dictée. Détails: ${error.message}</p>`;
    }
}

// NOTE: Cette fonction utilise la route /tts de votre serveur proxy
async function generateAndPlayTTS(text) {
    const correctionDiv = document.getElementById('correction-feedback');
    correctionDiv.innerHTML = '<p class="info">🎶 Génération et lecture audio en cours...</p>';
    
    // Mettre à jour l'URL d'appel pour la fonction
    const ttsUrl = `${TTS_API_URL}`; 

    try {
        const response = await fetch(ttsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });
        
        if (response.ok) {
            // Créer un blob pour l'audio et le lire
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.play().then(() => {
                // Le bouton permet de rejouer l'audio
                correctionDiv.innerHTML = `<p class="correct">🔊 Écoutez la dictée et écrivez le texte ci-dessous.</p><button onclick="generateAndPlayTTS('${text.replace(/'/g, "\\'")}')">Rejouer l'audio</button>`;
            }).catch(e => {
                correctionDiv.innerHTML = `<p class="warn">🔊 **Lecture audio bloquée.** Veuillez cliquer ici : <button onclick="generateAndPlayTTS('${text.replace(/'/g, "\\'")}')">Lancer l'audio</button></p>`;
                console.warn("Lecture audio bloquée, nécessite interaction utilisateur.", e);
            });
        } else {
            correctionDiv.innerHTML = `<p class="error">❌ Le serveur n'a pas pu générer l'audio (TTS : ${response.statusText}).</p>`;
            console.error("Erreur TTS:", response.status, response.statusText);
        }

    } catch (error) {
        console.error("Erreur lors de l'appel TTS:", error);
        correctionDiv.innerHTML = `<p class="error">❌ Erreur de connexion pour la synthèse vocale. Détails: ${error.message}</p>`;
    }
}

/**
 * Soumet la réponse de l'utilisateur à l'IA pour une correction détaillée
 * pour les questions à réponse courte ou longue.
 */
async function submitTextAnswer() {
    const currentQuestion = currentQuizData[currentQuestionIndex];
    const correctionFeedbackDiv = document.getElementById('correction-feedback');
    const answerElement = document.getElementById('answer-box');
    const validateButton = document.querySelector('.paragraphe-sujet button');
    
    if (!answerElement || answerElement.value.trim() === '') {
        alert("Veuillez saisir votre réponse.");
        return;
    }

    const userAnswer = answerElement.value.trim();
    const correctAnswer = currentQuestion.answer;
    const maxPoints = currentQuestion.maxPoints || 1;
    const questionText = currentQuestion.question;

    // 1. Démarrer l'état de chargement
    validateButton.disabled = true;
    validateButton.textContent = '⏳ Correction en cours...';
    correctionFeedbackDiv.innerHTML = '<p class="info">Analyse de votre réponse par l\'IA...</p>';

    try {
        const payload = {
            userAnswer: userAnswer,
            correctAnswer: correctAnswer,
            questionText: questionText,
            maxPoints: maxPoints
        };

        const response = await fetch(CORRECTION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Erreur réseau ou du serveur de correction.');

        const data = await response.json();

        // 2. Traitement du résultat de l'IA
        if (data.score && data.feedback) {
            const scoreObtained = parseFloat(data.score) || 0;
            userScore += scoreObtained;

            let feedbackHTML = `<p class="alert-info">✅ **Correction IA :**</p>`;
            feedbackHTML += `<p>Score obtenu : **${scoreObtained.toFixed(2)} / ${maxPoints} points**</p>`;
            feedbackHTML += `<div style="padding: 10px; border: 1px solid #ccc; background-color: #f9f9f9;">${parseMarkdown(data.feedback)}</div>`;
            feedbackHTML += `<p>Réponse attendue : ${parseMarkdown(currentQuestion.answer)}</p>`;
            
            correctionFeedbackDiv.innerHTML = feedbackHTML;
        } else {
            correctionFeedbackDiv.innerHTML = '<p class="error">❌ Erreur : L\'IA n\'a pas renvoyé un format de correction valide.</p>';
        }

    } catch (error) {
        console.error("Erreur de correction IA :", error);
        correctionFeedbackDiv.innerHTML = `<p class="error">❌ Erreur lors de la correction : ${error.message}.</p>`;
    } finally {
        // 3. Finalisation de l'interface
        answerElement.disabled = true;
        validateButton.style.display = 'none';
        document.getElementById('next-question-btn').style.display = 'block';
    }
}

// --- FONCTIONS D'AFFICHAGE DU QUIZ (Spot Error inclus) ---
// (Même logique d'affichage que précédemment, Spot Error est géré)

function displayCurrentQuestion() {
    // DANS function displayCurrentQuestion()

    // Ligne CRITIQUE : Masquer le bouton de validation de la question précédente (s'il existe)
    const validateButton = document.getElementById('validate-answer-btn'); 
    if (validateButton) {
        validateButton.style.display = 'none'; 
    }
    
    // Assurez-vous aussi que la zone de feedback est vide au début de la nouvelle question
    document.getElementById('correction-feedback').innerHTML = '';

    // ... (Le reste de votre fonction pour afficher la nouvelle question)
    if (currentQuestionIndex >= currentQuizData.length) {
        showFinalScore();
        return;
    }
    
    // Nettoyage de l'interface
    const correctionFeedbackDiv = document.getElementById('correction-feedback');
    if (correctionFeedbackDiv) correctionFeedbackDiv.innerHTML = '';
    
    const nextQuestionBtn = document.getElementById('next-question-btn');
    if (nextQuestionBtn) nextQuestionBtn.style.display = 'none';

    const currentQuestion = currentQuizData[currentQuestionIndex];
    const questionContainer = document.getElementById('question-container');
    let html = '';

    const questionText = parseMarkdown(currentQuestion.question || currentQuestion.sujet || currentQuestion.text || '');
    
    html += `<h3 style="margin-bottom: 20px; text-align: right;">Question ${currentQuestionIndex + 1} sur ${currentQuizData.length} (Source : ${currentQuestion.sourceName || 'Génération IA'})</h3>`;

    // 🥳 CORRECTION CRITIQUE 1 : Utilisation de toLowerCase()
    const questionType = currentQuestion.type ? currentQuestion.type.toLowerCase() : 'unknown';

    switch (questionType) {
        // 🥳 CORRECTION CRITIQUE 2 : Ajout de 'mcq' pour plus de tolérance
        case 'qcm':
        case 'mcq':
            html += `
                <div class="qcm-question">
                    <h3>Question à Choix Multiples (Points: ${currentQuestion.maxPoints || 1})</h3>
                    <p class="question-text">${questionText}</p>
                    <div class="options">
                        ${currentQuestion.options.map((option) => `
                            <label>
                                <input type="radio" name="qcm_answer" value="${option}"> ${parseMarkdown(option)}
                            </label>
                        `).join('')}
                    </div>
                    <button onclick="checkFreeTextAnswer()">Valider et Afficher la Correction</button>
                </div>
            `;
            break;

        // 🥳 CORRECTION CRITIQUE 3 : Ajout des types 'short_answer' et 'long_answer'
    case 'short_answer':
    case 'long_answer':
        // C'est ICI que l'appel est défini dans le HTML généré !
        html += `
            <div class="paragraphe-sujet">
                <textarea id="answer-box" rows="${questionType === 'long_answer' ? 10 : 5}" placeholder="Votre réponse ici..."></textarea>
                
                <button onclick="submitTextAnswer()">Soumettre à l'IA pour correction</button> 
            </div>
        `;
        break;

        case 'vrai_faux': 
            html += `
                <div class="vrai-faux-question">
                    <h3>Vrai ou Faux (Points: ${currentQuestion.maxPoints || 1})</h3>
                    <p class="question-text">${questionText}</p>
                    <div class="options">
                        <label>
                            <input type="radio" name="vrai_faux_answer" value="Vrai"> Vrai
                        </label>
                        <label>
                            <input type="radio" name="vrai_faux_answer" value="Faux"> Faux
                        </label>
                    </div>
                    <button onclick="checkAnswer()">Valider la réponse</button>
                </div>
            `;
            break;

        case 'paragraphe_ia':
            // Ce cas gère votre ancien mode de correction IA avancée si vous le souhaitez
            html += `
                <div class="paragraphe-sujet">
                    <h3>Sujet de Rédaction (Correction IA)</h3>
                    <p class="question-text">${questionText}</p>
                    <p style="font-style: italic; color: #555;">**Attendus :** ${currentQuestion.attendus ? currentQuestion.attendus.join(' / ') : 'Non spécifié.'}</p>
                    <textarea id="paragraphe-answer" rows="10" placeholder="Rédigez votre paragraphe ici..."></textarea>
                    <button onclick="submitParagrapheIA('${currentQuestion.consigne_ia ? currentQuestion.consigne_ia.replace(/'/g, "\\'") : ''}')">Soumettre à l'IA</button>
                    <div id="paragraphe-correction-ia" class="feedback-box"></div>
                </div>
            `;
            break;
            
        case 'spot_error': 
            html += `
                <div class="spot-error-question">
                    <h3>Trouver l'Erreur (Points: ${currentQuestion.maxPoints || 5})</h3>
                    <p class="question-text">${questionText}</p>
                    <div class="error-text-box feedback-box" style="border: 2px dashed #dc3545; background-color: #f8d7da; margin-bottom: 15px;">
                        <p style="font-weight: bold; margin-bottom: 5px;">Énoncé à analyser :</p>
                        <p style="font-style: italic;">${parseMarkdown(currentQuestion.texte_avec_erreur)}</p>
                    </div>
                    <p>Quel est l'erreur dans cet énoncé et comment doit-il être corrigé ?</p>
                    <textarea id="spot_error-answer" rows="5" placeholder="L'erreur est... La correction est..."></textarea>
                    <button onclick="checkSpotErrorAnswer()">Soumettre la correction à l'IA</button>
                    <div id="spot_error-correction-ia" class="feedback-box"></div>
                </div>
            `;
            break;
            
        case 'dictation':
            html += `
                <div class="dictation-question">
                    <h3>Dictée</h3>
                    <p>La dictée sera jouée automatiquement. Écoutez attentivement et écrivez le texte dans la zone ci-dessous.</p>
                    <textarea id="dictation-answer" rows="5" placeholder="Écrivez le texte de la dictée ici..."></textarea>
                    <button onclick="submitDictation('${currentQuestion.text.replace(/'/g, "\\'")}')">Soumettre la dictée</button>
                </div>
            `;
            break;

        default:
            // Affichage détaillé de l'erreur pour le débogage
            html = `<p class="error">Type de question inconnu. Le type reçu de l'IA est: <strong>${currentQuestion.type}</strong>.</p>`;
            break;
    }

    questionContainer.innerHTML = html;
}
// --- FONCTIONS DE CORRECTION ---

// Correction pour QCM et Vrai/Faux (non IA) - (Inchangée)
function checkAnswer() {
    const currentQuestion = currentQuizData[currentQuestionIndex];
    let userAnswer = null;
    let score = 0;
    let feedback = '';
    const resultDiv = document.getElementById('correction-feedback');
    
    if (resultDiv) resultDiv.innerHTML = '';
    
    if (currentQuestion.type === 'qcm') {
        const selected = document.querySelector('input[name="qcm_answer"]:checked');
        if (!selected) { alert("Veuillez sélectionner une option."); return; }
        userAnswer = selected.value;
        
        const isCorrect = (userAnswer.trim() === currentQuestion.correct_answer.trim());
        
        if (isCorrect) {
            score = currentQuestion.points;
            feedback = `<p class="correct">✅ **Correct !**</p>`;
        } else {
            score = 0;
            feedback = `<p class="incorrect">❌ **Incorrect.** La bonne réponse était **${parseMarkdown(currentQuestion.correct_answer)}**.</p>`;
        }

    } 
    else if (currentQuestion.type === 'vrai_faux') { 
        const selected = document.querySelector('input[name="vrai_faux_answer"]:checked');
        if (!selected) { alert("Veuillez sélectionner 'Vrai' ou 'Faux'."); return; }
        userAnswer = selected.value;
        
        const isCorrect = (userAnswer.trim().toLowerCase() === currentQuestion.correct_answer.trim().toLowerCase());
        
        if (isCorrect) {
            score = currentQuestion.points;
            feedback = `<p class="correct">✅ **Correct !**</p>`;
        } else {
            score = 0;
            feedback = `<p class="incorrect">❌ **Incorrect.** La bonne réponse était **${currentQuestion.correct_answer}**.</p>`;
        }
    }
    else {
        return;
    }
    
    userScore += score;
    resultDiv.innerHTML = feedback;
    document.getElementById('next-question-btn').style.display = 'block';
}

// Correction pour Spot the Error (via IA) - (Utilise le même endpoint de correction que le paragraphe)
async function checkSpotErrorAnswer() {
    const currentQuestion = currentQuizData[currentQuestionIndex];
    const answerElement = document.getElementById('spot_error-answer');
    const userAnswer = answerElement ? answerElement.value.trim() : '';
    const correctionDiv = document.getElementById('spot_error-correction-ia');
    const resultDiv = document.getElementById('correction-feedback'); 

    if (userAnswer.length < 10) {
        alert("Veuillez écrire votre correction de l'erreur.");
        return;
    }
    
    correctionDiv.innerHTML = '<p class="info">⏳ Envoi à l\'IA pour évaluation...</p>';
    
    // Le prompt doit contenir toutes les informations nécessaires pour l'IA
    const consigne_ia = `Vous êtes un correcteur de quiz. La tâche de l'élève était de trouver l'erreur factuelle dans l'énoncé suivant : "${currentQuestion.texte_avec_erreur}". L'erreur VRAIMENT attendue est : "${currentQuestion.correct_answer}". Votre rôle est de comparer la réponse de l'élève à l'erreur attendue et d'évaluer la qualité de sa correction sur les ${currentQuestion.points} points disponibles. Donnez des commentaires constructifs et le score obtenu.`;
    
    const userPrompt = `${consigne_ia}\nRéponse de l'élève:\n---\n${userAnswer}\n---`;
    
    try {
        const response = await fetch(CORRECTION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Le serveur s'attend à un objet simple contenant le prompt, le serveur gère la structure OpenAI.
            body: JSON.stringify({ prompt: userPrompt, model: "gpt-4o-mini" }) 
        });

        const aiData = await response.json();
        
        if (aiData.error) { throw new Error(aiData.error.details || aiData.error); }

        if (aiData.correction_text) {
            const formattedCorrection = parseMarkdown(aiData.correction_text);
            correctionDiv.innerHTML = `<div class="ia-feedback">${formattedCorrection}</div>`;
            
            // Extraction du score par regex (méthode non idéale mais nécessaire sans JSON structuré)
            const scoreMatch = aiData.correction_text.match(/score obtenu\s*:\s*(\d+)\s*\/\s*(\d+)/i);
            let score = 0;
            if (scoreMatch) {
                // Tenter de récupérer le score attribué (scoreMatch[1])
                score = parseInt(scoreMatch[1] || 0);
            } else {
                // Fallback: si l'IA ne renvoie pas le format exact, on attribue 0 ou 1 point si la correction semble bonne
                 score = userAnswer.toLowerCase().includes(currentQuestion.correct_answer.toLowerCase().substring(0, 10)) ? 1 : 0;
            }
            
            userScore += score;
            resultDiv.innerHTML = `<p class="correct">✅ **Correction IA fournie. Vous obtenez ${score} points (sur ${currentQuestion.points})**</p>`;

        } else {
            correctionDiv.innerHTML = '<p class="error">❌ Erreur: L\'IA n\'a pas retourné de correction valide.</p>';
        }

    } catch (error) {
        console.error("Erreur lors de la correction par l'IA (Spot Error):", error);
        correctionDiv.innerHTML = `<p class="error">❌ Erreur de connexion au serveur d'IA. Détails: ${error.message}</p>`;
    }
    
    document.getElementById('next-question-btn').style.display = 'block';
}


async function submitParagrapheIA(consigne_ia) {
    const answerElement = document.getElementById('paragraphe-answer');
    const userAnswer = answerElement ? answerElement.value.trim() : '';
    const correctionDiv = document.getElementById('paragraphe-correction-ia');

    if (userAnswer.length < 50) {
        alert("Veuillez rédiger un paragraphe d'au moins 50 caractères.");
        return;
    }

    correctionDiv.innerHTML = '<p class="info">⏳ Soumission à l\'IA pour correction détaillée (cela peut prendre quelques secondes)...</p>';
    
    const userPrompt = `${consigne_ia}\n\nParagraphe de l'élève:\n---\n${userAnswer}\n---`;

    try {
        const response = await fetch(CORRECTION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: userPrompt, model: "gpt-4o-mini" }) // Modèle utilisé pour la correction
        });

        const aiData = await response.json();
        
        if (aiData.error) { throw new Error(aiData.error.details || aiData.error); }
        
        if (aiData.correction_text) {
            const formattedCorrection = parseMarkdown(aiData.correction_text);
            correctionDiv.innerHTML = `<div class="ia-feedback">${formattedCorrection}</div>`;
        } else {
            correctionDiv.innerHTML = '<p class="error">❌ Erreur: L\'IA n\'a pas retourné de correction valide.</p>';
        }

    } catch (error) {
        console.error("Erreur lors de la correction par l'IA (Paragraphe):", error);
        correctionDiv.innerHTML = `<p class="error">❌ Erreur de connexion au serveur d'IA. Détails: ${error.message}</p>`;
    }
    
    document.getElementById('next-question-btn').style.display = 'block';
}

// Dictation submission (Inchangée)
function submitDictation(originalText) {
    const answerElement = document.getElementById('dictation-answer');
    const userAnswer = answerElement ? answerElement.value.trim() : '';
    const resultDiv = document.getElementById('correction-feedback');

    if (userAnswer.length === 0) {
        alert("Veuillez écrire votre dictée.");
        return;
    }

    const normalizedUser = userAnswer.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim();
    const normalizedOriginal = originalText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim();

    if (normalizedUser === normalizedOriginal) {
        resultDiv.innerHTML = `<p class="correct">✅ **Excellent !** Vous avez une orthographe et une syntaxe parfaites.</p>`;
        userScore += 1; 
        totalQuizPoints += 1;
    } else {
        resultDiv.innerHTML = `<p class="incorrect">❌ **Erreurs détectées.** Votre version contient des différences.</p>
                               <p>Version attendue : **${originalText}**</p>
                               <p>Votre version : **${userAnswer}**</p>`;
        totalQuizPoints += 1;
    }
    document.getElementById('next-question-btn').style.display = 'block';
}

// --- Navigation et Score Final (Inchangée) ---

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
         feedback += `<p>Ce quiz contenait principalement des sujets de rédaction ou des erreurs dans le calcul du score total.</p>`;
    }

    document.getElementById('question-container').innerHTML = feedback + '<button onclick="window.location.reload()">Recommencer un quiz</button>';
}
