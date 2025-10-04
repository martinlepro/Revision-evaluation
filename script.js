// script.js (Modifié pour la note /20, la structure et la correction de bug)

window.onerror = function(msg, url, line, col, error) {
    document.getElementById('debug').textContent =
      "Erreur JS : " + msg + "\nLigne: " + line + "\n" + (error ? error.stack : "");
};
console.log("script.js chargé.");

const MATIERES_BASE_PATH = 'matieres';
let selectedItems = []; // Stocke les objets de leçon sélectionnés { path, type, name }
let currentQuizData = []; // Données des questions générées par l'IA
let currentQuestionIndex = 0;
let correctAnswersCount = 0; // Nombre de bonnes réponses
let totalQuizPoints = 0; // Le score total du quiz (doit être 20)
let userScore = 0; // Score de l'utilisateur
let isQuizRunning = false; // NOUVEAU : Drapeau pour prévenir le spam de "Commencer le quiz"

// URL de votre serveur proxy sécurisé sur Render
const BASE_API_URL = 'https://cle-api.onrender.com';
const CORRECTION_API_URL = `${BASE_API_URL}/correction`; 
const GENERATION_API_URL = `${BASE_API_URL}/generation`; 

// --- Gestion de la structure des matières (Mise à jour) ---
const STRUCTURE = {
    "Mathematiques": {
        "Nombres_Premiers": [
            { name: "Leçon Nombres Premiers", file: "lecon_nombres_premiers.txt", type: "qcm" }
        ],
        "T1_STATISTIQUES": [
            { name: "Statistiques (QCM)", file: "lecon_statistiques.txt", type: "qcm" } 
        ],
        "Les_Aires": [
            { name: "Les Aires (Paragraphe)", file: "lecon_aires.txt", type: "paragraphe" }
        ]
    },
    "Histoire_Geo": {
        "La_Revolution_Francaise": [
            { name: "Révolution Française", file: "lecon_revolution.txt", type: "paragraphe" }
        ],
        "Les_Fleuves_du_Monde": [
            { name: "Les Fleuves du Monde (QCM)", file: "lecon_fleuves.txt", type: "qcm" }
        ]
    },
    "Allemand": {
        "<prefixe verbe>": [
            { name: "Les Verbes à Préfixe", file: "lecon_prefixe_verbe.txt", type: "qcm" }
        ],
        "<facile,tenter,important>": [
            { name: "Vocabulaire Facile", file: "lecon_vocabulaire_facile.txt", type: "qcm" }
        ],
        "Grammaire_Base": [
            { name: "Grammaire de Base", file: "lecon_grammaire_base.txt", type: "qcm" }
        ]
    },
    "Art_Plastique": { // NOUVELLE MATIÈRE
        "<description>": [
            { name: "Analyse d'Œuvre", file: "lecon_description_oeuvre.txt", type: "paragraphe" }
        ]
    }
};

// --- Initialisation et chargement des ressources ---

document.addEventListener('DOMContentLoaded', () => {
    loadStructure();
    // Le bouton utilise maintenant le drapeau isQuizRunning
    document.getElementById('start-quiz-btn').addEventListener('click', startQuiz); 
});


// --- Fonctions de chargement et sélection (inchangées) ---

function loadStructure() {
    const menuContainer = document.getElementById('menu-container');
    menuContainer.innerHTML = '';

    for (const matiere in STRUCTURE) {
        const matiereDiv = document.createElement('div');
        matiereDiv.className = 'matiere';
        matiereDiv.innerHTML = `<h2>${matiere.replace(/_/g, ' ')}</h2>`;
        
        const ul = document.createElement('ul');

        for (const chapitre in STRUCTURE[matiere]) {
            const chapitreLi = document.createElement('li');
            chapitreLi.innerHTML = `<h3>${chapitre.replace(/_/g, ' ')}</h3>`;
            const itemsList = document.createElement('ul');

            STRUCTURE[matiere][chapitre].forEach(itemObject => { 
                const itemLi = document.createElement('li');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                
                // Remplacement du préfixe <exemple> pour un affichage plus propre
                const chapterPath = `${matiere}/${chapitre.replace(/[<>]/g, '')}`;
                const fullPath = `${MATIERES_BASE_PATH}/${chapterPath}/${itemObject.file}`;
                
                checkbox.dataset.item = JSON.stringify({ 
                    path: fullPath,
                    type: itemObject.type,
                    name: itemObject.name
                });
                
                checkbox.id = fullPath;
                checkbox.addEventListener('change', updateSelection);

                const label = document.createElement('label');
                label.htmlFor = fullPath;
                label.textContent = `${itemObject.name} (${itemObject.type.toUpperCase()})`; 

                itemLi.appendChild(checkbox);
                itemLi.appendChild(label);
                itemsList.appendChild(itemLi);
            });
            
            chapitreLi.appendChild(itemsList);
            ul.appendChild(chapitreLi);
        }
        matiereDiv.appendChild(ul);
        menuContainer.appendChild(matiereDiv);
    }
}

function updateSelection(event) {
    const itemObject = JSON.parse(event.target.dataset.item);

    if (event.target.checked) {
        selectedItems.push(itemObject);
    } else {
        selectedItems = selectedItems.filter(item => item.path !== itemObject.path);
    }
    
    const selectionDisplay = document.getElementById('selected-items');
    selectionDisplay.textContent = selectedItems.map(item => item.name).join(' | ');
}

// --- Logique principale du Quiz (Mise à jour pour le bug de démarrage) ---

async function startQuiz() {
    if (selectedItems.length === 0) {
        alert("Veuillez sélectionner au moins une leçon à réviser !");
        return;
    }
    
    // NOUVEAU : Empêcher le double-clic
    if (isQuizRunning) {
        console.log("Quiz déjà en cours de génération/exécution.");
        return;
    }
    isQuizRunning = true; 
    
    // Initialisation des variables de score
    correctAnswersCount = 0;
    totalQuizPoints = 0;
    userScore = 0;

    document.getElementById('selection-view').style.display = 'none';
    document.getElementById('quiz-view').style.display = 'block';

    currentQuizData = []; 
    
    for (const lesson of selectedItems) {
        try {
            document.getElementById('question-container').innerHTML = `<h2>🧠 Génération du contenu pour **${lesson.name}** (${lesson.type.toUpperCase()}) en cours...</h2>`;
            
            const lessonResponse = await fetch(lesson.path);
            if (!lessonResponse.ok) {
                throw new Error(`Le fichier de leçon ${lesson.path} n'a pas été trouvé (Status: ${lessonResponse.status}).`);
            }
            const lessonText = await lessonResponse.text();
            
            const fullPrompt = createGenerationPrompt(lesson.type, lessonText);
            const generatedContentJSON = await callGenerationAPI(fullPrompt);

            if (lesson.type === 'qcm') {
                if (generatedContentJSON.questions && Array.isArray(generatedContentJSON.questions)) {
                    currentQuizData.push(...generatedContentJSON.questions);
                } else {
                    console.warn("L'IA a généré un JSON QCM mais le champ 'questions' est manquant ou non valide.", generatedContentJSON);
                }
            } else if (lesson.type === 'paragraphe') {
                currentQuizData.push(generatedContentJSON);
            }

        } catch (error) {
            console.error(`Erreur lors du traitement de la leçon ${lesson.name}:`, error);
            document.getElementById('question-container').innerHTML = `
                <h2>❌ Erreur de Génération</h2>
                <p>Impossible de générer le contenu pour **${lesson.name}**.</p>
                <p class="error">Détails: ${error.message}</p>
                <button onclick="window.location.reload()">Retour au menu</button>`;
            isQuizRunning = false; // Libérer le drapeau en cas d'échec
            return; 
        }
    }
    
    if (currentQuizData.length === 0) {
         document.getElementById('question-container').innerHTML = `
            <h2>❌ Aucune question n'a pu être générée.</h2>
            <button onclick="window.location.reload()">Retour au menu</button>`;
        isQuizRunning = false;
        return;
    }

    // Calcul du score total des QCM générés (doit être 20)
    totalQuizPoints = currentQuizData
        .filter(item => item.type === 'qcm')
        .reduce((sum, item) => sum + (item.points || 0), 0);
    
    currentQuizData.sort(() => Math.random() - 0.5);
    currentQuestionIndex = 0;
    displayCurrentQuestion();
    isQuizRunning = false; // Le quiz est lancé, le drapeau peut être désactivé ici (ou au rechargement)
}


// --- Fonctions d'aide pour l'IA (Mise à jour du QCM prompt) ---

function createGenerationPrompt(type, lessonText) {
    if (type === 'qcm') {
        // NOUVEAU : Instruction pour la pondération sur 20 points
        return `Vous êtes un générateur de quiz pour des élèves de 3ème. Générez entre 5 et 10 questions à choix multiples (QCM) basées UNIQUEMENT sur la leçon fournie ci-dessous.
        
        Chaque question doit inclure un champ 'points' (ex: 2, 3 ou 4) représentant sa difficulté. Le TOTAL des points de toutes les questions doit être EXCLUSIVEMENT 20.
        
        Le format de retour doit être STRICTEMENT un objet JSON. 
        Le format JSON attendu est : 
        { "questions": [
            {"type": "qcm", "question": "...", "options": ["...", "...", "..."], "reponse_correcte": "...", "explication": "...", "points": X },
            ...
        ]}
        
        LEÇON FOURNIE :
        ---
        ${lessonText}
        ---
        `;
    } else if (type === 'paragraphe') {
        // Remplacement du préfixe <exemple> par le sujet pour le prompt
        const sujetCleaned = selectedItems
            .filter(item => item.path.includes(lessonText.substring(0, 50)))
            .map(item => item.name)[0] || "Paragraphe Argumenté";

        return `Vous êtes un concepteur de sujets d'examen pour des élèves de 3ème. Générez UN sujet de paragraphe argumenté basé UNIQUEMENT sur la leçon fournie ci-dessous.
        
        Le format de retour doit être STRICTEMENT un objet JSON.
        Le format JSON attendu est : 
        { "type": "paragraphe_ia", "sujet": "${sujetCleaned}", "attendus": ["...", "...", "..."], "consigne_ia": "Corrigez le texte de l'élève en 3e. Notez-le sur 10, en prenant en compte la clarté des arguments, la pertinence des exemples donnés et la structure de l'exposé." }
        
        LEÇON FOURNIE :
        ---
        ${lessonText}
        ---
        `;
    }
    return "Erreur: Type de contenu inconnu.";
}

async function callGenerationAPI(fullPrompt) {
    // ... (Fonction inchangée) ...
    const response = await fetch(GENERATION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_prompt: fullPrompt }),
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({error: 'Réponse serveur non-JSON ou vide.'}));
        throw new Error(`Erreur API Render lors de la Génération: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.generated_content) {
        try {
            return JSON.parse(data.generated_content);
        } catch (e) {
            console.error("Erreur de parsing JSON de l'IA:", data.generated_content);
            throw new Error("L'IA n'a pas renvoyé un format JSON valide.");
        }
    } else {
        throw new Error("Réponse de génération incomplète: 'generated_content' manquant.");
    }
}


// --- Fonctions de rendu (Mise à jour de l'affichage QCM) ---

function displayCurrentQuestion() {
    const questionData = currentQuizData[currentQuestionIndex];
    const container = document.getElementById('question-container');
    
    // Affichage du score actuel (uniquement si c'est un QCM)
    let scoreDisplay = '';
    if (totalQuizPoints > 0) {
        scoreDisplay = ` | Score: ${userScore} / ${totalQuizPoints} pts`;
    }
    
    container.innerHTML = `<h3>Question ${currentQuestionIndex + 1} / ${currentQuizData.length}${scoreDisplay}</h3>`;
    document.getElementById('next-question-btn').style.display = 'none';

    if (questionData.type === 'qcm') {
        container.innerHTML += renderQCM(questionData);
    } else if (questionData.type === 'paragraphe_ia') {
        container.innerHTML += renderParagraphe(questionData);
    }
}

function renderQCM(data) {
    // Affiche la pondération de la question
    const pointsDisplay = data.points ? `<p class="qcm-points">Cette question vaut **${data.points}** points.</p>` : '';
    
    let html = `<div class="qcm-question">
        ${pointsDisplay}
        <h4>${data.question}</h4>`;
    data.options.forEach((option, index) => {
        const id = `qcm-option-${index}`;
        html += `
            <input type="radio" id="${id}" name="qcm-answer" value="${option}">
            <label for="${id}">${option}</label><br>
        `;
    });
    html += `<button onclick="submitQCM()">Valider</button></div>`;
    return html;
}

// --- Fonctions de soumission et de correction (Mise à jour du score QCM) ---

function submitQCM() {
    const questionData = currentQuizData[currentQuestionIndex];
    const resultDiv = document.getElementById('correction-feedback');
    const selectedOption = document.querySelector('input[name="qcm-answer"]:checked');

    if (!selectedOption) {
        alert("Veuillez sélectionner une réponse.");
        return;
    }

    const userAnswer = selectedOption.value;
    const isCorrect = userAnswer === questionData.reponse_correcte;
    const points = questionData.points || 0;

    if (isCorrect) {
        // NOUVEAU : Ajout des points au score utilisateur
        userScore += points; 
        
        resultDiv.innerHTML = `<p class="correct">✅ Correct! Vous gagnez **${points} points**.</p><p>${questionData.explication}</p>`;
    } else {
        resultDiv.innerHTML = `<p class="incorrect">❌ Faux. Vous ne gagnez aucun point.</p><p>La réponse correcte était: **${questionData.reponse_correcte}**.</p><p>Explication: ${questionData.explication}</p>`;
    }

    document.getElementById('next-question-btn').style.display = 'block';
}


// --- Navigation (Mise à jour pour le score final) ---

function nextQuestion() {
    const correctionFeedbackDiv = document.getElementById('correction-feedback');
    if (correctionFeedbackDiv) {
        correctionFeedbackDiv.innerHTML = '';
    }
    const nextQuestionBtn = document.getElementById('next-question-btn');
    if (nextQuestionBtn) {
        nextQuestionBtn.style.display = 'none';
    }

    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuizData.length) {
        displayCurrentQuestion();
    } else {
        // FIN DU QUIZ : Affichage du score total
        const finalNote = (userScore / totalQuizPoints) * 20; // Calcul de la note sur 20
        const finalNoteRounded = finalNote.toFixed(2);
        
        let feedback = `<h2>🎉 Quiz terminé !</h2>`;
        if (totalQuizPoints > 0) {
            feedback += `<p>Votre performance globale est de **${userScore} / ${totalQuizPoints} points**.</p>`;
            feedback += `<h3>Votre note sur 20 est : **${finalNoteRounded} / 20**</h3>`;
        } else {
             feedback += `<p>Aucune question QCM n'a été trouvée pour la notation.</p>`;
        }

        document.getElementById('question-container').innerHTML = feedback + '<button onclick="window.location.reload()">Recommencer</button>';
        // Le drapeau est implicitement réinitialisé par le rechargement de la page.
    }
}


// --- Fonctions inchangées ---
async function submitParagrapheIA() {
    const questionData = currentQuizData[currentQuestionIndex];
    const userAnswer = document.getElementById('ia-answer').value.trim();
    const resultDiv = document.getElementById('correction-feedback');

    if (userAnswer.length < 50) {
        alert("Veuillez écrire un paragraphe plus long (minimum 50 caractères).");
        return;
    }
    
    resultDiv.innerHTML = '<p>Correction par l\'IA en cours... 🧠</p>';
    
    const prompt = `${questionData.consigne_ia}\n\nTexte de l'élève à corriger:\n\n---\n${userAnswer}\n---`;
    
    try {
        const responseText = await callCorrectionAPI(prompt); 
        
        resultDiv.innerHTML = `<div class="ia-feedback">${responseText}</div>`;
        document.getElementById('next-question-btn').style.display = 'block';

    } catch (error) {
        console.error("Erreur lors de la correction:", error);
        resultDiv.innerHTML = `<p class="error">❌ Erreur de connexion à l'IA. Détails: ${error.message}</p>`;
    }
}

async function callCorrectionAPI(prompt) {
    const response = await fetch(CORRECTION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt }),
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({error: 'Réponse serveur non-JSON ou vide.'}));
        throw new Error(`Erreur API Render lors de la Correction: ${errorData.error || response.statusText}`);
    }

    const data = await response.json(); 
    return data.correction_text;
            }
