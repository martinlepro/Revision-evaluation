// script.js
window.onerror = function(msg, url, line, col, error) {
    document.getElementById('debug').textContent =
      "Erreur JS : " + msg + "\nLigne: " + line + "\n" + (error ? error.stack : "");
};
console.log("script.js chargé.");

const MATIERES_BASE_PATH = 'matieres';
let selectedItems = []; // Stocke les objets de leçon sélectionnés { path, type, name }
let currentQuizData = []; // Données des questions générées par l'IA
let currentQuestionIndex = 0;

// URL de votre serveur proxy sécurisé sur Render (avec les NOUVELLES routes)
const BASE_API_URL = 'https://cle-api.onrender.com';
const CORRECTION_API_URL = `${BASE_API_URL}/correction`; // Route de correction
const GENERATION_API_URL = `${BASE_API_URL}/generation`; // Route de génération à partir du prompt complet

// --- Gestion de la structure des matières ---
// Chaque leçon est un OBJET qui pointe vers le fichier .txt et spécifie le type de quiz à générer.
const STRUCTURE = {
    "Mathematiques": {
        "Nombres_Premiers": [
            { name: "Leçon Nombres Premiers", file: "lecon_nombres_premiers.txt", type: "qcm" }
        ],
        "T1_STATISTIQUES": [
             // Assurez-vous d'avoir ce fichier dans matieres/Mathematiques/T1_STATISTIQUES/
            { name: "Statistiques (QCM)", file: "lecon_statistiques.txt", type: "qcm" } 
        ],
        "Les_Aires": [
            { name: "Les Aires (Paragraphe)", file: "lecon_aires.txt", type: "paragraphe" }
        ]
    },
    "Histoire_Geo": {
        "La_Revolution_Francaise": [
            // Assurez-vous d'avoir ce fichier dans matieres/Histoire_Geo/La_Revolution_Francaise/
            { name: "Révolution Française", file: "lecon_revolution.txt", type: "paragraphe" }
        ],
        "Les_Fleuves_du_Monde": [
            { name: "Les Fleuves du Monde (QCM)", file: "lecon_fleuves.txt", type: "qcm" }
        ]
    },
    "Allemand": {
        // --- Chapitres ajoutés ---
        "<préfixe verbe>": [
            { name: "Les Verbes à Préfixe", file: "lecon_prefixe_verbe.txt", type: "qcm" }
        ],
        "<facile,tenter,important>": [
            { name: "Vocabulaire Facile", file: "lecon_vocabulaire_facile.txt", type: "qcm" }
        ],
        "Grammaire_Base": [
            { name: "Grammaire de Base", file: "lecon_grammaire_base.txt", type: "qcm" }
        ]
        // --- Fin des ajouts ---
    }
};

// --- Initialisation et chargement des ressources ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Lancement de l'affichage de la structure des matières
    loadStructure();

    // 2. Événement du bouton de démarrage du quiz
    document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
});

// --- Fonctions de chargement et sélection ---

function loadStructure() {
    const menuContainer = document.getElementById('menu-container');
    menuContainer.innerHTML = '';

    for (const matiere in STRUCTURE) {
        const matiereDiv = document.createElement('div');
        matiereDiv.className = 'matiere';
        matiereDiv.innerHTML = `<h2>${matiere}</h2>`;
        
        const ul = document.createElement('ul');

        for (const chapitre in STRUCTURE[matiere]) {
            const chapitreLi = document.createElement('li');
            chapitreLi.innerHTML = `<h3>${chapitre.replace(/_/g, ' ')}</h3>`;
            const itemsList = document.createElement('ul');

            STRUCTURE[matiere][chapitre].forEach(itemObject => { // itemObject = {name, file, type}
                const itemLi = document.createElement('li');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                
                // Chemin complet du fichier de leçon (.txt)
                const fullPath = `${MATIERES_BASE_PATH}/${matiere}/${chapitre}/${itemObject.file}`;
                
                // On stocke l'objet complet de la leçon dans l'attribut data-item
                checkbox.dataset.item = JSON.stringify({ 
                    path: fullPath,
                    type: itemObject.type,
                    name: itemObject.name
                });
                
                checkbox.id = fullPath;
                checkbox.addEventListener('change', updateSelection);

                const label = document.createElement('label');
                label.htmlFor = fullPath;
                // Affichage : Nom de la leçon (Type de quiz)
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
    // Récupérer l'objet complet stocké dans l'attribut data-item
    const itemObject = JSON.parse(event.target.dataset.item);

    if (event.target.checked) {
        selectedItems.push(itemObject);
    } else {
        // Retirer l'élément de la sélection en comparant les chemins
        selectedItems = selectedItems.filter(item => item.path !== itemObject.path);
    }
    
    // Affichage des éléments sélectionnés
    const selectionDisplay = document.getElementById('selected-items');
    selectionDisplay.textContent = selectedItems.map(item => item.name).join(' | ');
}

// --- Logique principale du Quiz (Révisée pour la génération à la volée) ---

async function startQuiz() {
    if (selectedItems.length === 0) {
        alert("Veuillez sélectionner au moins une leçon à réviser !");
        return;
    }
    
    document.getElementById('selection-view').style.display = 'none';
    document.getElementById('quiz-view').style.display = 'block';

    currentQuizData = []; // Réinitialise les données pour les nouveaux quiz
    
    // 1. Pour chaque leçon sélectionnée, générer le contenu via l'IA
    for (const lesson of selectedItems) {
        try {
            // Affichage de chargement
            document.getElementById('question-container').innerHTML = `
                <h2>🧠 Génération du contenu pour **${lesson.name}** (${lesson.type.toUpperCase()}) en cours...</h2>
                <p>Ceci peut prendre quelques secondes.</p>`;
            
            // 2. Récupérer le contenu brut de la leçon (.txt) depuis GitHub Pages
            const lessonResponse = await fetch(lesson.path);
            if (!lessonResponse.ok) {
                throw new Error(`Le fichier de leçon ${lesson.path} n'a pas été trouvé (Status: ${lessonResponse.status}). Assurez-vous qu'il existe !`);
            }
            const lessonText = await lessonResponse.text();
            
            // 3. Construire le prompt complet pour l'IA
            const fullPrompt = createGenerationPrompt(lesson.type, lessonText);
            
            // 4. Appeler le serveur Render pour la génération
            const generatedContentJSON = await callGenerationAPI(fullPrompt);

            // 5. Mettre le contenu généré à jour
            if (lesson.type === 'qcm') {
                 // Si c'est un QCM, l'objet retourné contient un tableau 'questions'
                if (generatedContentJSON.questions && Array.isArray(generatedContentJSON.questions)) {
                    currentQuizData.push(...generatedContentJSON.questions);
                } else {
                    console.warn("L'IA a généré un JSON QCM mais le champ 'questions' est manquant ou non valide.", generatedContentJSON);
                }
            } else if (lesson.type === 'paragraphe') {
                // Si c'est un paragraphe, on ajoute l'objet unique
                currentQuizData.push(generatedContentJSON);
            }

        } catch (error) {
            console.error(`Erreur lors du traitement de la leçon ${lesson.name}:`, error);
            document.getElementById('question-container').innerHTML = `
                <h2>❌ Erreur de Génération</h2>
                <p>Impossible de générer le contenu pour **${lesson.name}**.</p>
                <p class="error">Détails: ${error.message}</p>
                <button onclick="window.location.reload()">Retour au menu</button>`;
            return; 
        }
    }
    
    // 6. Démarrer l'affichage du quiz
    if (currentQuizData.length === 0) {
         document.getElementById('question-container').innerHTML = `
            <h2>❌ Aucune question n'a pu être générée. Vérifiez le format du JSON retourné par l'IA.</h2>
            <button onclick="window.location.reload()">Retour au menu</button>`;
        return;
    }
    
    // Mélange et affichage
    currentQuizData.sort(() => Math.random() - 0.5);
    currentQuestionIndex = 0;
    displayCurrentQuestion();
}


// --- Fonctions d'aide pour l'IA ---

function createGenerationPrompt(type, lessonText) {
    // Cette fonction construit le prompt SYSTEM pour dire à l'IA CE QU'ON ATTEND (JSON)
    // et lui fournit les données (la Leçon).

    if (type === 'qcm') {
        return `Vous êtes un générateur de quiz pour des élèves de 3ème. Générez 3 questions à choix multiples (QCM) basées UNIQUEMENT sur la leçon fournie ci-dessous.
        
        Le format de retour doit être STRICTEMENT un objet JSON. 
        Le format JSON attendu est : 
        { "questions": [
            {"type": "qcm", "question": "...", "options": ["...", "...", "..."], "reponse_correcte": "...", "explication": "..." },
            ...
        ]}
        
        LEÇON FOURNIE :
        ---
        ${lessonText}
        ---
        `;
    } else if (type === 'paragraphe') {
        return `Vous êtes un concepteur de sujets d'examen pour des élèves de 3ème. Générez UN sujet de paragraphe argumenté basé UNIQUEMENT sur la leçon fournie ci-dessous.
        
        Le format de retour doit être STRICTEMENT un objet JSON.
        Le format JSON attendu est : 
        { "type": "paragraphe_ia", "sujet": "...", "attendus": ["...", "...", "..."], "consigne_ia": "Corrigez le texte de l'élève en 3e. Notez-le sur 10, en prenant en compte la clarté des arguments, la pertinence des exemples donnés et la structure de l'exposé." }
        
        LEÇON FOURNIE :
        ---
        ${lessonText}
        ---
        `;
    }
    return "Erreur: Type de contenu inconnu.";
}

// Fonction qui appelle la route /generation du serveur Render
async function callGenerationAPI(fullPrompt) {
    const response = await fetch(GENERATION_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            full_prompt: fullPrompt // Le prompt complet incluant la leçon
        }),
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({error: 'Réponse serveur non-JSON ou vide.'}));
        throw new Error(`Erreur API Render lors de la Génération: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json(); // Réponse du serveur: { generated_content: "JSON_STRING" }
    
    if (data.generated_content) {
        // L'IA renvoie une CHAÎNE JSON. Il faut la parser pour obtenir l'objet.
        try {
            return JSON.parse(data.generated_content);
        } catch (e) {
            console.error("Erreur de parsing JSON de l'IA:", data.generated_content);
            throw new Error("L'IA n'a pas renvoyé un format JSON valide (vérifiez votre prompt sur le serveur).");
        }
    } else {
        throw new Error("Réponse de génération incomplète: 'generated_content' manquant.");
    }
}


// --- Fonctions de rendu (Inchagées pour le moment) ---

function displayCurrentQuestion() {
    // ... (Code de displayCurrentQuestion non modifié)
    const questionData = currentQuizData[currentQuestionIndex];
    const container = document.getElementById('question-container');
    container.innerHTML = `<h3>Question ${currentQuestionIndex + 1} / ${currentQuizData.length}</h3>`;
    document.getElementById('next-question-btn').style.display = 'none';

    if (questionData.type === 'qcm') {
        container.innerHTML += renderQCM(questionData);
    } else if (questionData.type === 'paragraphe_ia') {
        container.innerHTML += renderParagraphe(questionData);
    }
}

function renderQCM(data) {
    // ... (Code de renderQCM non modifié)
    let html = `<div class="qcm-question"><h4>${data.question}</h4>`;
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

function renderParagraphe(data) {
    // ... (Code de renderParagraphe non modifié)
    let html = `<div class="paragraphe-sujet"><h4>Sujet : ${data.sujet}</h4>`;
    html += `<textarea id="ia-answer" rows="10" placeholder="Rédigez votre paragraphe argumenté ici..."></textarea>`;
    html += `<button onclick="submitParagrapheIA()">Envoyer à l'IA pour correction</button></div>`;
    return html;
}


// --- Fonctions de soumission et de correction (Inchagées) ---

function submitQCM() {
    // ... (Code de submitQCM non modifié)
    const questionData = currentQuizData[currentQuestionIndex];
    const resultDiv = document.getElementById('correction-feedback');
    const selectedOption = document.querySelector('input[name="qcm-answer"]:checked');

    if (!selectedOption) {
        alert("Veuillez sélectionner une réponse.");
        return;
    }

    const userAnswer = selectedOption.value;
    const isCorrect = userAnswer === questionData.reponse_correcte;

    if (isCorrect) {
        resultDiv.innerHTML = `<p class="correct">✅ Correct!</p><p>${questionData.explication}</p>`;
    } else {
        resultDiv.innerHTML = `<p class="incorrect">❌ Faux.</p><p>La réponse correcte était: **${questionData.reponse_correcte}**.</p><p>Explication: ${questionData.explication}</p>`;
    }

    document.getElementById('next-question-btn').style.display = 'block';
}


async function submitParagrapheIA() {
    // ... (Code de submitParagrapheIA non modifié)
    const questionData = currentQuizData[currentQuestionIndex];
    const userAnswer = document.getElementById('ia-answer').value.trim();
    const resultDiv = document.getElementById('correction-feedback');

    if (userAnswer.length < 50) {
        alert("Veuillez écrire un paragraphe plus long (minimum 50 caractères).");
        return;
    }
    
    resultDiv.innerHTML = '<p>Correction par l\'IA en cours... 🧠</p>';
    
    // Le prompt contient la consigne pour l'IA et la réponse de l'élève
    const prompt = `${questionData.consigne_ia}\n\nTexte de l'élève à corriger:\n\n---\n${userAnswer}\n---`;
    
    try {
        // *** APPEL AU PROXY RENDER SÉCURISÉ ***
        const responseText = await callCorrectionAPI(prompt); 
        
        // La réponse textuelle inclut la note et les commentaires
        resultDiv.innerHTML = `<div class="ia-feedback">${responseText}</div>`;
        document.getElementById('next-question-btn').style.display = 'block';

    } catch (error) {
        console.error("Erreur lors de la correction:", error);
        resultDiv.innerHTML = `<p class="error">❌ Erreur de connexion à l'IA. Vérifiez votre service Render. Détails: ${error.message}</p>`;
    }
}


// Fonction d'appel à la route /correction
async function callCorrectionAPI(prompt) {
    const response = await fetch(CORRECTION_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt: prompt 
        }),
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({error: 'Réponse serveur non-JSON ou vide.'}));
        throw new Error(`Erreur API Render lors de la Correction: ${errorData.error || response.statusText}`);
    }

    const data = await response.json(); 
    // Le serveur renvoie { correction_text: "..." }
    return data.correction_text;
}


// --- Navigation ---

function nextQuestion() {
    // ... (Code de nextQuestion non modifié)
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
        document.getElementById('question-container').innerHTML = '<h2>🎉 Quiz terminé ! Félicitations !</h2><button onclick="window.location.reload()">Recommencer</button>';
    }
}
