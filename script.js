// script.js
window.onerror = function(msg, url, line, col, error) {
  document.getElementById('debug').textContent =
    "Erreur JS : " + msg + "\nLigne: " + line + "\n" + (error ? error.stack : "");
};
console.log("script.js chargé."); // Log au chargement du script

const MATIERES_BASE_PATH = 'matieres';
let config = {};
let selectedItems = []; // Tableau pour stocker les objets de sélection { path, typeToGenerate, displayName }
let currentQuizData = []; // Données des questions pour le quiz actuel
let currentQuestionIndex = 0;

// URL de votre serveur proxy sécurisé sur Render (avec les NOUVELLES routes)
const BASE_API_URL = 'https://cle-api.onrender.com';
const CORRECTION_API_URL = `${BASE_API_URL}/correction`;
const GENERATION_API_URL = `${BASE_API_URL}/generation`;

console.log("BASE_API_URL:", BASE_API_URL);
console.log("CORRECTION_API_URL:", CORRECTION_API_URL);
console.log("GENERATION_API_URL:", GENERATION_API_URL);


// --- Gestion de la structure des matières ---
// Chaque leçon est maintenant un objet qui spécifie le type de contenu à générer
// et pointe vers un fichier .txt
const STRUCTURE = {
    "Mathematiques": {
        "Nombres_Premiers": [
            { name: "Leçon Nombres Premiers", file: "lecon_nombres_premiers.txt", type: "qcm" }
        ],
        "Les_Aires": [
            { name: "Leçon Les Aires", file: "lecon_les_aires.txt", type: "qcm" }
        ]
    },
    "Histoire_Geo": {
        "La_Revolution_Francaise": [
            { name: "Leçon Révolution Française", file: "lecon_revolution_francaise.txt", type: "paragraphe_ia" }
        ],
        "Les_Fleuves_du_Monde": [
            { name: "Leçon Fleuves du Monde", file: "lecon_fleuves_monde.txt", type: "qcm" }
        ]
    },
    "Allemand": {
        "Vocabulaire_Facile": [
            { name: "Leçon Vocabulaire Facile", file: "lecon_vocabulaire_facile.txt", type: "qcm" }
        ],
        "Grammaire_Base": [
            { name: "Leçon Grammaire de Base", file: "lecon_grammaire_base.txt", type: "qcm" }
        ]
    }
};

// --- Initialisation et chargement des ressources ---

// Ton gestionnaire d'erreurs global
window.onerror = function(msg, url, line, col, error) {
    const debugElement = document.getElementById('debug');
    if (debugElement) {
        debugElement.textContent =
            "Erreur JS : " + msg + "\nLigne: " + line + "\n" + (error ? error.stack : "");
        console.error("Global JS Error:", msg, url, line, col, error);
    } else {
        console.error("Global JS Error (debug element not found):", msg, url, line, col, error);
    }
    return true; // Empêche l'erreur de se propager aux outils de développement (optionnel)
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM content chargé. Initialisation...");

    fetch('config.json')
        .then(response => {
            console.log("Réponse de config.json reçue.");
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            config = data;
            console.log('Configuration chargée:', config);
            loadStructure();
        })
        .catch(error => {
            console.error("Erreur de chargement de config.json ou de parsing JSON:", error);
            loadStructure(); // Tente de charger la structure même sans config.json
        });

    document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
    
    // Ajout des écouteurs pour les boutons de génération IA aléatoire
    const generateQCMBtn = document.getElementById('generate-qcm-btn');
    const generateParagrapheBtn = document.getElementById('generate-paragraphe-btn');

    if (generateQCMBtn) {
        generateQCMBtn.addEventListener('click', () => generateContentFromAI('qcm'));
        console.log("Écouteur pour 'Générer QCM Aléatoire' attaché.");
    } else {
        console.warn("Bouton 'generate-qcm-btn' non trouvé.");
    }

    if (generateParagrapheBtn) {
        generateParagrapheBtn.addEventListener('click', () => generateContentFromAI('paragraphe_ia'));
        console.log("Écouteur pour 'Générer Paragraphe Aléatoire' attaché.");
    } else {
        console.warn("Bouton 'generate-paragraphe-btn' non trouvé.");
    }
    console.log("Écouteurs d'événements attachés.");
});


// --- Gestion de la structure des matières (Affichage) ---

function loadStructure() {
    console.log("Début du chargement de la structure des matières...");
    const menuContainer = document.getElementById('menu-container');
    if (!menuContainer) {
        console.error("Conteneur de menu (#menu-container) non trouvé.");
        return;
    }
    menuContainer.innerHTML = '';

    for (const matiere in STRUCTURE) {
        console.log("Ajout de la matière:", matiere);
        const matiereDiv = document.createElement('div');
        matiereDiv.className = 'matiere';
        matiereDiv.innerHTML = `<h2>${matiere}</h2>`;

        const chapitresList = document.createElement('ul');

        for (const chapitre in STRUCTURE[matiere]) {
            console.log("  Ajout du chapitre:", chapitre);
            const chapitreLi = document.createElement('li');
            chapitreLi.innerHTML = `<h3>${chapitre.replace(/_/g, ' ')}</h3>`; // Affiche le nom sans underscore

            const itemsList = document.createElement('ul');
            STRUCTURE[matiere][chapitre].forEach(itemConfig => { // itemConfig est maintenant { name, file, type }
                console.log("    Ajout de l'élément de leçon:", itemConfig.name, "(type:", itemConfig.type, ")");
                const itemLi = document.createElement('li');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                
                // Chemin complet du fichier de la leçon
                const fullPath = `${MATIERES_BASE_PATH}/${matiere}/${chapitre}/${itemConfig.file}`;
                // Stocker l'objet complet de la sélection dans la valeur de la checkbox
                checkbox.value = JSON.stringify({ path: fullPath, typeToGenerate: itemConfig.type, displayName: itemConfig.name });
                checkbox.id = fullPath.replace(/[^a-zA-Z0-9]/g, '_'); // ID unique et valide pour HTML
                
                checkbox.addEventListener('change', updateSelection);

                const label = document.createElement('label');
                label.htmlFor = checkbox.id; // Lier le label à l'ID de la checkbox
                label.textContent = itemConfig.name; // Afficher le nom convivial
                label.title = `Générera un ${itemConfig.type.replace('_ia', '')} à partir de cette leçon.`;

                itemLi.appendChild(checkbox);
                itemLi.appendChild(label);
                itemsList.appendChild(itemLi);
            });

            chapitreLi.appendChild(itemsList);
            chapitresList.appendChild(chapitreLi);
        }

        matiereDiv.appendChild(chapitresList);
        menuContainer.appendChild(matiereDiv);
    }
    console.log("Structure des matières chargée.");
}

function updateSelection(event) {
    const selectionData = JSON.parse(event.target.value); // Parser l'objet stocké
    if (event.target.checked) {
        selectedItems.push(selectionData);
        console.log("Sélection ajoutée:", selectionData);
    } else {
        selectedItems = selectedItems.filter(item => item.path !== selectionData.path);
        console.log("Sélection retirée:", selectionData);
    }
    console.log("Éléments actuellement sélectionnés:", selectedItems);
    
    const selectionDisplay = document.getElementById('selected-items');
    if (selectionDisplay) {
        // Afficher quelque chose de significatif, ex: "QCM from Leçon Nombres Premiers"
        selectionDisplay.textContent = selectedItems.map(s => `${s.typeToGenerate.replace('_ia', '').toUpperCase()} from "${s.displayName}"`).join(' | ');
    } else {
        console.warn("Élément 'selected-items' non trouvé pour l'affichage de la sélection.");
    }
}

// --- Logique du Quiz/Paragraphe ---

async function startQuiz() {
    console.log("Démarrage de la fonction startQuiz.");
    if (selectedItems.length === 0) {
        alert("Veuillez sélectionner au moins une leçon à partir de laquelle générer !");
        console.warn("startQuiz annulé: aucun élément sélectionné.");
        return;
    }
    
    const selectionView = document.getElementById('selection-view');
    const quizView = document.getElementById('quiz-view');
    const generationFeedbackDiv = document.getElementById('ai-generation-feedback'); // Pour les messages de génération
    
    if (!(selectionView && quizView && generationFeedbackDiv)) {
        console.error("Éléments 'selection-view', 'quiz-view' ou 'ai-generation-feedback' non trouvés.");
        return;
    }
    
    // Afficher la vue du quiz et les messages de génération en attendant
    selectionView.style.display = 'none';
    quizView.style.display = 'block';
    generationFeedbackDiv.style.display = 'block'; // S'assurer qu'il est visible pendant la génération
    generationFeedbackDiv.innerHTML = '<p>🧠 Préparation des questions par l\'IA...</p>';

    currentQuizData = []; // Réinitialise les données du quiz

    for (const selection of selectedItems) { // Chaque sélection est un objet { path, typeToGenerate, displayName }
        generationFeedbackDiv.innerHTML = `<p>🧠 Génération de ${selection.typeToGenerate.replace('_ia', '').toUpperCase()} à partir de la leçon "${selection.displayName}"...</p>`;
        try {
            console.log("Chargement du contenu de la leçon depuis:", selection.path);
            const response = await fetch(selection.path);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${selection.path}`);
            }
            const lessonContent = await response.text(); // Lit le contenu comme du texte brut
            console.log("Contenu de la leçon chargé (début):", lessonContent.substring(0, Math.min(lessonContent.length, 100)) + (lessonContent.length > 100 ? "..." : ""));

            // Préparer le prompt pour l'IA, incluant le contenu de la leçon
            let promptTextForGeneration;
            if (selection.typeToGenerate === 'qcm') {
                promptTextForGeneration = `Vous êtes un générateur de quiz pour des élèves de 3ème. Créez UN QCM de niveau collège (3ème) avec 4 options de réponse et une explication pour la bonne réponse, en vous basant STRICTEMENT et UNIQUEMENT sur le texte de la leçon ci-dessous. Le QCM doit être au format JSON prêt à être utilisé par mon application. Répondez UNIQUEMENT avec l'objet JSON.
                Leçon:\n${lessonContent}\n
                Exemple de format : { "type": "qcm", "question": "...", "options": ["...","...","...","..."], "reponse_correcte": "...", "explication": "..." }`;
            } else if (selection.typeToGenerate === 'paragraphe_ia') {
                promptTextForGeneration = `Vous êtes un concepteur de sujets d'examen pour des élèves de 3ème. Générez UN sujet de paragraphe argumenté de niveau collège (3ème) en vous basant STRICTEMENT et UNIQUEMENT sur le texte de la leçon ci-dessous. Incluez 3 à 4 attendus pour ce paragraphe et une consigne spécifique pour la correction par l'IA. Répondez UNIQUEMENT avec l'objet JSON.
                Leçon:\n${lessonContent}\n
                Exemple de format : { "type": "paragraphe_ia", "sujet": "...", "attendus": ["...", "...", "..."], "consigne_ia": "Corrigez ce paragraphe argumenté d'un élève de 3ème. Donnez une note sur 10 et des commentaires constructifs sur l'argumentation, la structure et la maîtrise du sujet." }`;
            } else {
                console.warn("Type de génération inconnu pour la sélection:", selection);
                generationFeedbackDiv.innerHTML += `<p class="error">❌ Type de génération inconnu pour "${selection.displayName}".</p>`;
                continue; // Passe à l'élément suivant
            }

            console.log("Appel à l'API de génération avec la leçon. Prompt (début):", promptTextForGeneration.substring(0, Math.min(promptTextForGeneration.length, 200)) + (promptTextForGeneration.length > 200 ? "..." : ""));
            const aiGeneratedResponse = await fetch(GENERATION_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: promptTextForGeneration }),
            });

            console.log("Réponse de l'API de génération reçue pour leçon. Statut:", aiGeneratedResponse.status);

            if (!aiGeneratedResponse.ok) {
                const errorData = await aiGeneratedResponse.json().catch(() => ({error: 'Réponse AI non-JSON ou vide.'}));
                throw new Error(`Erreur API Render lors de la génération (status ${aiGeneratedResponse.status}): ${errorData.error || aiGeneratedResponse.statusText}`);
            }

            const aiData = await aiGeneratedResponse.json();
            console.log("Données de l'API de génération parsées pour leçon:", aiData);
            
            if (aiData.generated_content) {
                console.log("Chaîne JSON générée par l'IA à partir de leçon:", aiData.generated_content);
                const generatedQuestion = JSON.parse(aiData.generated_content);
                
                // Si l'IA renvoie un tableau de questions (ex: pour un QCM multiple), ou un seul objet
                if (Array.isArray(generatedQuestion)) {
                    currentQuizData.push(...generatedQuestion);
                } else {
                    currentQuizData.push(generatedQuestion);
                }
                console.log("Question(s) générée(s) par l'IA à partir de la leçon:", generatedQuestion);
            } else {
                console.error("Réponse de génération AI incomplète: 'generated_content' manquant pour leçon.", aiData);
                generationFeedbackDiv.innerHTML += `<p class="error">❌ Échec de génération pour "${selection.displayName}".</p>`;
            }
        } catch (error) {
            console.error(`Erreur lors du traitement de la leçon "${selection.displayName}":`, error);
            generationFeedbackDiv.innerHTML += `<p class="error">❌ Erreur grave pour "${selection.displayName}": ${error.message}</p>`;
        }
    }
    
    generationFeedbackDiv.innerHTML = ''; // Nettoyer les messages de génération après tout
    generationFeedbackDiv.style.display = 'none'; // Cacher le feedback une fois la génération terminée

    if (currentQuizData.length === 0) {
        alert("Aucune question n'a pu être générée. Veuillez vérifier vos sélections ou l'API de génération.");
        // Revenir à la vue de sélection ou afficher un message d'erreur persistant
        quizView.style.display = 'none';
        selectionView.style.display = 'block';
        console.warn("startQuiz terminé: aucune question générée.");
        return;
    }

    currentQuizData.sort(() => Math.random() - 0.5); // Mélanger les questions générées
    console.log("Toutes les questions des leçons ont été générées et mélangées. Total:", currentQuizData.length, "questions.");

    currentQuestionIndex = 0;
    displayCurrentQuestion();
    console.log("Quiz démarré avec la première question générée.");
}

function displayCurrentQuestion() {
    console.log("Affichage de la question actuelle. Index:", currentQuestionIndex, "/", currentQuizData.length);
    const questionContainer = document.getElementById('question-container');
    if (!questionContainer) {
        console.error("Conteneur de question (#question-container) non trouvé.");
        return;
    }
    
    const questionData = currentQuizData[currentQuestionIndex];

    if (!questionData) {
        console.log("Fin des questions disponibles. Affichage du message de fin.");
        questionContainer.innerHTML = `<h2>Bravo, vous avez terminé la révision !</h2>
            <button onclick="window.location.reload()">Recommencer</button>`;
        return;
    }
    
    let html = `<h3>Question ${currentQuestionIndex + 1} / ${currentQuizData.length}</h3>`;
    
    if (questionData.type === 'qcm') {
        console.log("Affichage d'un QCM:", questionData.question);
        html += `<div class="qcm-question"><h4>${questionData.question}</h4>`;
        
        questionData.options.forEach((option, index) => {
            html += `<label>
                        <input type="radio" name="qcm-answer" value="${option}" id="qcm-option-${index}">
                        ${option}
                    </label><br>`;
        });
        
        html += `<button onclick="submitQCM()">Valider</button></div>`;
        
    } else if (questionData.type === 'paragraphe_ia') {
        console.log("Affichage d'un sujet de paragraphe IA:", questionData.sujet);
        html += `<div class="paragraphe-sujet"><h4>Sujet : ${questionData.sujet}</h4>
                 <p>Attendus : ${questionData.attendus.join(', ')}</p>
                 <textarea id="ia-answer" rows="10" placeholder="Écrivez votre paragraphe argumenté ici..."></textarea>
                 <button onclick="submitParagrapheIA()">Envoyer à l'IA pour correction</button></div>`;
    } else {
        console.warn("Type de question inconnu:", questionData.type, "pour les données:", questionData);
        html += `<p class="error">Type de question inconnu. Impossible d'afficher.</p>`;
    }

    questionContainer.innerHTML = html;
    
    const correctionFeedbackDiv = document.getElementById('correction-feedback');
    if (correctionFeedbackDiv) {
        correctionFeedbackDiv.innerHTML = '';
    } else {
        console.warn("Élément 'correction-feedback' non trouvé.");
    }

    const nextQuestionBtn = document.getElementById('next-question-btn');
    if (nextQuestionBtn) {
        nextQuestionBtn.style.display = 'none';
    } else {
        console.warn("Bouton 'next-question-btn' non trouvé.");
    }
}

// --- Fonctions de Soumission et Correction ---

function submitQCM() {
    console.log("Soumission du QCM...");
    const questionData = currentQuizData[currentQuestionIndex];
    const selected = document.querySelector('input[name="qcm-answer"]:checked');
    const resultDiv = document.getElementById('correction-feedback');
    
    if (!selected) {
        alert("Veuillez sélectionner une réponse.");
        console.warn("Validation QCM annulée: aucune réponse sélectionnée.");
        return;
    }
    
    const userAnswer = selected.value;
    console.log("Réponse utilisateur QCM:", userAnswer);
    console.log("Réponse correcte attendue:", questionData.reponse_correcte);

    if (!resultDiv) {
        console.error("Élément 'correction-feedback' non trouvé.");
        return;
    }
    
    if (userAnswer === questionData.reponse_correcte) {
        resultDiv.innerHTML = '<p class="correct">✅ Bonne réponse !</p>';
        console.log("Réponse QCM correcte.");
    } else {
        let feedback = `<p class="incorrect">❌ Faux. La bonne réponse était : <strong>${questionData.reponse_correcte}</strong>.</p>`;
        if (questionData.explication) {
            feedback += `<p>Explication : ${questionData.explication}</p>`;
        }
        resultDiv.innerHTML = feedback;
        console.log("Réponse QCM incorrecte. Explication:", questionData.explication || "Aucune.");
    }

    const nextQuestionBtn = document.getElementById('next-question-btn');
    if (nextQuestionBtn) {
        nextQuestionBtn.style.display = 'block';
    }
}

// Fonction qui appelle votre proxy Render sécurisé sur la route /correction
async function callCorrectionAPI(prompt) {
    console.log("Appel à l'API de correction. Prompt envoyé (début):", prompt.substring(0, Math.min(prompt.length, 200)) + (prompt.length > 200 ? "..." : ""));
    try {
        const response = await fetch(CORRECTION_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt // On envoie le prompt que votre serveur Render attend
            }),
        });
        console.log("Réponse de l'API de correction reçue. Statut:", response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({error: 'Réponse serveur non-JSON ou vide.'}));
            console.error("Erreur brute de l'API de correction:", errorData);
            throw new Error(`Erreur API Render (${response.status}): ${errorData.error || response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Données de l'API de correction parsées:", data);
        
        if (data.correction_text) {
            return data.correction_text;
        } else {
            console.error("Réponse de l'API incomplète ou mal formée pour la correction:", data);
            return "L'IA n'a pas pu générer de correction pour le moment. Réponse inattendue du serveur.";
        }
    } catch (error) {
        console.error("Erreur lors de l'appel réseau ou du parsing de l'API de correction:", error);
        throw error; // Rejette l'erreur pour qu'elle soit gérée plus haut
    }
}


async function submitParagrapheIA() {
    console.log("Soumission du paragraphe pour correction IA...");
    const questionData = currentQuizData[currentQuestionIndex];
    const userAnswer = document.getElementById('ia-answer')?.value.trim(); // Utilisation de l'opérateur optionnel chaining
    const resultDiv = document.getElementById('correction-feedback');

    if (!userAnswer || userAnswer.length < 50) {
        alert("Veuillez écrire un paragraphe plus long (minimum 50 caractères).");
        console.warn("Validation paragraphe annulée: texte trop court ou vide.");
        return;
    }
    if (!resultDiv) {
        console.error("Élément 'correction-feedback' non trouvé.");
        return;
    }
    
    resultDiv.innerHTML = '<p>Correction par l\'IA en cours... 🧠</p>';
    console.log("Paragraphe utilisateur soumis (début):", userAnswer.substring(0, Math.min(userAnswer.length, 100)) + (userAnswer.length > 100 ? "..." : ""));
    
    // Le prompt contient la consigne pour l'IA et la réponse de l'élève
    const prompt = `${questionData.consigne_ia}\n\nTexte de l'élève à corriger:\n\n---\n${userAnswer}\n---`;
    
    try {
        const responseText = await callCorrectionAPI(prompt); 
        console.log("Correction de l'IA reçue (début):", responseText.substring(0, Math.min(responseText.length, 200)) + (responseText.length > 200 ? "..." : ""));
        
        // On remplace les sauts de ligne (\n) par des balises <br> pour un meilleur affichage HTML
        const formattedText = responseText.replace(/\n/g, '<br>');
        
        resultDiv.innerHTML = `<div class="ia-feedback">${formattedText}</div>`;
        const nextQuestionBtn = document.getElementById('next-question-btn');
        if (nextQuestionBtn) {
            nextQuestionBtn.style.display = 'block';
        }
        console.log("Correction IA affichée.");

    } catch (error) {
        console.error("Erreur lors de la correction par l'IA:", error);
        resultDiv.innerHTML = `<p class="error">❌ Erreur de connexion à l'IA. Vérifiez votre service Render. Détails: ${error.message}</p>`;
    }
}

// Fonction pour générer du contenu aléatoire (via les boutons dédiés)
async function generateContentFromAI(contentType) {
    console.log("Début de la génération de contenu par l'IA (aléatoire). Type demandé:", contentType);
    const generationFeedbackDiv = document.getElementById('ai-generation-feedback');
    if (!generationFeedbackDiv) {
        console.error("Élément 'ai-generation-feedback' non trouvé.");
        return;
    }
    
    // Afficher la vue du quiz et les messages de génération en attendant
    document.getElementById('selection-view').style.display = 'none';
    document.getElementById('quiz-view').style.display = 'block';
    generationFeedbackDiv.style.display = 'block';
    generationFeedbackDiv.innerHTML = '<p>🧠 Sélection d\'une leçon aléatoire et génération par l\'IA...</p>';
    
    // 1. Collecter toutes les leçons disponibles qui correspondent au type de contenu
    const allLessons = [];
    for (const matiere in STRUCTURE) {
        for (const chapitre in STRUCTURE[matiere]) {
            STRUCTURE[matiere][chapitre].forEach(itemConfig => {
                if (itemConfig.type === contentType) {
                    const fullPath = `${MATIERES_BASE_PATH}/${matiere}/${chapitre}/${itemConfig.file}`;
                    allLessons.push({ path: fullPath, typeToGenerate: itemConfig.type, displayName: itemConfig.name });
                }
            });
        }
    }

    if (allLessons.length === 0) {
        generationFeedbackDiv.innerHTML = `<p class="error">❌ Aucune leçon de type "${contentType.replace('_ia', '')}" trouvée pour la génération aléatoire.</p>`;
        console.warn("Aucune leçon trouvée pour la génération aléatoire de type:", contentType);
        // Revenir à la vue de sélection
        document.getElementById('quiz-view').style.display = 'none';
        document.getElementById('selection-view').style.display = 'block';
        return;
    }

    // 2. Choisir une leçon aléatoirement
    const randomLesson = allLessons[Math.floor(Math.random() * allLessons.length)];
    console.log("Leçon aléatoire sélectionnée:", randomLesson);
    generationFeedbackDiv.innerHTML = `<p>🧠 Génération de ${randomLesson.typeToGenerate.replace('_ia', '').toUpperCase()} à partir de la leçon aléatoire "${randomLesson.displayName}"...</p>`;

    try {
        // 3. Charger le contenu de la leçon aléatoire
        console.log("Chargement du contenu de la leçon aléatoire depuis:", randomLesson.path);
        const response = await fetch(randomLesson.path);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${randomLesson.path}`);
        }
        const lessonContent = await response.text(); // Lit le contenu comme du texte brut
        console.log("Contenu de la leçon aléatoire chargé (début):", lessonContent.substring(0, Math.min(lessonContent.length, 100)) + (lessonContent.length > 100 ? "..." : ""));

        // 4. Préparer le prompt pour l'IA, incluant le contenu de la leçon aléatoire
        let promptTextForGeneration;
        if (contentType === 'qcm') {
            promptTextForGeneration = `Vous êtes un générateur de quiz pour des élèves de 3ème. Créez UN QCM de niveau collège (3ème) avec 4 options de réponse et une explication pour la bonne réponse, en vous basant STRICTEMENT et UNIQUEMENT sur le texte de la leçon ci-dessous. Le QCM doit être au format JSON prêt à être utilisé par mon application. Répondez UNIQUEMENT avec l'objet JSON.
            Leçon:\n${lessonContent}\n
            Exemple de format : { "type": "qcm", "question": "...", "options": ["...","...","...","..."], "reponse_correcte": "...", "explication": "..." }`;
        } else if (contentType === 'paragraphe_ia') {
            promptTextForGeneration = `Vous êtes un concepteur de sujets d'examen pour des élèves de 3ème. Générez UN sujet de paragraphe argumenté de niveau collège (3ème) en vous basant STRICTEMENT et UNIQUEMENT sur le texte de la leçon ci-dessous. Incluez 3 à 4 attendus pour ce paragraphe et une consigne spécifique pour la correction par l'IA. Répondez UNIQUEMENT avec l'objet JSON.
            Leçon:\n${lessonContent}\n
            Exemple de format : { "type": "paragraphe_ia", "sujet": "...", "attendus": ["...", "...", "..."], "consigne_ia": "Corrigez ce paragraphe argumenté d'un élève de 3ème. Donnez une note sur 10 et des commentaires constructifs sur l'argumentation, la structure et la maîtrise du sujet." }`;
        } else {
            // Cette branche ne devrait pas être atteinte car contentType est déjà filtré
            generationFeedbackDiv.innerHTML = '<p class="error">Type de contenu inconnu pour la génération IA.</p>';
            console.warn("Type de contenu IA inconnu:", contentType);
            return;
        }

        console.log("Prompt préparé pour l'API de génération (aléatoire, début):", promptTextForGeneration.substring(0, Math.min(promptTextForGeneration.length, 200)) + (promptTextForGeneration.length > 200 ? "..." : ""));

        const aiGeneratedResponse = await fetch(GENERATION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptTextForGeneration }),
        });
        console.log("Réponse de l'API de génération reçue (aléatoire). Statut:", aiGeneratedResponse.status);

        if (!aiGeneratedResponse.ok) {
            const errorData = await aiGeneratedResponse.json().catch(() => ({error: 'Réponse serveur non-JSON ou vide.'}));
            throw new Error(`Erreur API Render (${aiGeneratedResponse.status}): ${errorData.error || aiGeneratedResponse.statusText}`);
        }

        const aiData = await aiGeneratedResponse.json();
        console.log("Données de l'API de génération parsées (aléatoire):", aiData);
        
        if (aiData.generated_content) {
            console.log("Chaîne JSON générée par l'IA (aléatoire):", aiData.generated_content);
            const generatedQuestion = JSON.parse(aiData.generated_content);
            
            if (generatedQuestion.type === contentType) {
                console.log("Contenu généré par l'IA parsé et validé (aléatoire):", generatedQuestion);
                currentQuizData = [generatedQuestion]; // Remplace les questions actuelles par celle générée
                selectedItems = []; // Réinitialise les éléments sélectionnés
                currentQuestionIndex = 0;
                
                generationFeedbackDiv.innerHTML = ''; // Nettoie le feedback
                generationFeedbackDiv.style.display = 'none'; // Cacher le feedback une fois la génération terminée
                console.log("Vue basculée sur le quiz avec la question aléatoire générée.");
                displayCurrentQuestion(); // Affiche la question générée
            } else {
                 generationFeedbackDiv.innerHTML = '<p class="error">❌ L\'IA a généré un type de contenu inattendu.</p>';
                 console.error("Le type de contenu généré par l'IA ne correspond pas au type demandé. Attendu:", contentType, "Reçu:", generatedQuestion.type);
            }
        } else {
            console.error("Réponse de l'API de génération incomplète ou mal formée (aléatoire): 'generated_content' manquant.", aiData);
            generationFeedbackDiv.innerHTML = '<p class="error">❌ L\'IA n\'a pas pu générer le contenu. Réponse inattendue du serveur.</p>';
        }

    } catch (error) {
        console.error("Erreur lors de la génération par l'IA (aléatoire):", error);
        generationFeedbackDiv.innerHTML = `<p class="error">❌ Erreur de connexion à l'IA ou format de réponse invalide. Détails: ${error.message}</p>`;
        // En cas d'erreur grave, on pourrait vouloir revenir à la sélection
        document.getElementById('quiz-view').style.display = 'none';
        document.getElementById('selection-view').style.display = 'block';
    }
}


// --- Navigation ---

function nextQuestion() {
    console.log("Passage à la question suivante.");
    const correctionFeedbackDiv = document.getElementById('correction-feedback');
    if (correctionFeedbackDiv) {
        correctionFeedbackDiv.innerHTML = '';
    }
    const nextQuestionBtn = document.getElementById('next-question-btn');
    if (nextQuestionBtn) {
        nextQuestionBtn.style.display = 'none';
    }

    currentQuestionIndex++;
    displayCurrentQuestion();
}
