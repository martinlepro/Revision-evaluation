const MATIERES_BASE_PATH = 'matieres';
let config = {};
let selectedItems = []; // Tableau pour stocker les chemins des fichiers JSON sélectionnés
let currentQuizData = []; // Données des questions pour le quiz actuel
let currentQuestionIndex = 0;

// --- Initialisation et chargement des ressources ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Chargement de la configuration (Clé API)
    fetch('config.json')
        .then(response => response.json())
        .then(data => {
            config = data;
            console.log('Configuration chargée.');
            // 2. Lancement de l'affichage de la structure des matières
            loadStructure();
        })
        .catch(error => {
            console.error("Erreur de chargement de config.json. L'IA ne fonctionnera pas.", error);
            alert("Erreur de chargement de la configuration de l'IA.");
        });

    document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
});

// --- Gestion de la structure des matières (Simulée) ---

// NOTE : Les navigateurs ne peuvent pas lire les fichiers d'un dossier directement.
// Nous allons SIMPLIFIER la structure pour l'exemple en la codant "en dur".
// Dans un vrai projet, vous passeriez par une étape de "build" pour générer ce JSON.
const STRUCTURE = {
    "Mathematiques": {
        "Chapitre_Nombres_Premiers": ["QCM_1.json"],
        "Chapitre_Les_Aires": ["QCM_Aires.json"]
    },
    "Histoire_Geo": {
        "La_Revolution_Francaise": ["Paragraphe_Argumente_1.json"],
        "Les_Fleuves_du_Monde": ["QCM_Geographie.json"]
    }
};

function loadStructure() {
    const menuContainer = document.getElementById('menu-container');
    menuContainer.innerHTML = '';

    for (const matiere in STRUCTURE) {
        const matiereDiv = document.createElement('div');
        matiereDiv.className = 'matiere';
        matiereDiv.innerHTML = `<h2>${matiere}</h2>`;

        const chapitresList = document.createElement('ul');

        for (const chapitre in STRUCTURE[matiere]) {
            const chapitreLi = document.createElement('li');
            chapitreLi.innerHTML = `<h3>${chapitre}</h3>`;

            const itemsList = document.createElement('ul');
            STRUCTURE[matiere][chapitre].forEach(item => {
                const itemLi = document.createElement('li');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                
                // Chemin complet du fichier
                const fullPath = `${MATIERES_BASE_PATH}/${matiere}/${chapitre}/${item}`;
                checkbox.value = fullPath;
                checkbox.id = fullPath;
                
                checkbox.addEventListener('change', updateSelection);

                const label = document.createElement('label');
                label.htmlFor = fullPath;
                label.textContent = item;

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
}

function updateSelection(event) {
    const path = event.target.value;
    if (event.target.checked) {
        selectedItems.push(path);
    } else {
        selectedItems = selectedItems.filter(item => item !== path);
    }
    
    // Mettre à jour l'affichage de la sélection
    const selectionDisplay = document.getElementById('selected-items');
    selectionDisplay.textContent = selectedItems.map(p => p.split('/').slice(-3).join(' > ')).join(' | ');
}

// --- Logique du Quiz/Paragraphe ---

async function startQuiz() {
    if (selectedItems.length === 0) {
        alert("Veuillez sélectionner au moins un chapitre/quiz à commencer !");
        return;
    }
    
    // Cacher le menu et afficher le quiz
    document.getElementById('selection-view').style.display = 'none';
    document.getElementById('quiz-view').style.display = 'block';

    currentQuizData = [];
    
    // Charger tous les fichiers JSON sélectionnés
    for (const itemPath of selectedItems) {
        try {
            const response = await fetch(itemPath);
            let data = await response.json();
            
            // Si le fichier est un tableau (QCM multiple), l'ajouter question par question
            if (Array.isArray(data)) {
                currentQuizData.push(...data);
            } else {
                 // Si c'est un objet simple (paragraphe IA), l'ajouter tel quel
                currentQuizData.push(data);
            }
        } catch (error) {
            console.error(`Erreur de chargement du fichier ${itemPath}:`, error);
        }
    }
    
    // Mélanger les questions (optionnel)
    currentQuizData.sort(() => Math.random() - 0.5);

    currentQuestionIndex = 0;
    displayCurrentQuestion();
}

function displayCurrentQuestion() {
    const questionContainer = document.getElementById('question-container');
    const questionData = currentQuizData[currentQuestionIndex];

    if (!questionData) {
        // Fin du quiz
        questionContainer.innerHTML = `<h2>Bravo, vous avez terminé la révision !</h2>
            <button onclick="window.location.reload()">Recommencer</button>`;
        return;
    }
    
    // Affichage du numéro de la question
    let html = `<h3>Question ${currentQuestionIndex + 1} / ${currentQuizData.length}</h3>`;
    
    if (questionData.type === 'qcm') {
        html += `<div class="qcm-question"><h4>${questionData.question}</h4>`;
        
        questionData.options.forEach((option, index) => {
            html += `<label>
                        <input type="radio" name="qcm-answer" value="${option}">
                        ${option}
                    </label><br>`;
        });
        
        html += `<button onclick="submitQCM()">Valider</button></div>`;
        
    } else if (questionData.type === 'paragraphe_ia') {
        html += `<div class="paragraphe-sujet"><h4>Sujet : ${questionData.sujet}</h4>
                 <p>Attendus : ${questionData.attendus.join(', ')}</p>
                 <textarea id="ia-answer" rows="10" placeholder="Écrivez votre paragraphe argumenté ici..."></textarea>
                 <button onclick="submitParagrapheIA()">Envoyer à l'IA pour correction</button></div>`;
    }

    questionContainer.innerHTML = html;
}

// --- Fonctions de Soumission et Correction ---

function submitQCM() {
    const questionData = currentQuizData[currentQuestionIndex];
    const selected = document.querySelector('input[name="qcm-answer"]:checked');
    const resultDiv = document.getElementById('correction-feedback');
    
    if (!selected) {
        alert("Veuillez sélectionner une réponse.");
        return;
    }
    
    const userAnswer = selected.value;
    
    if (userAnswer === questionData.reponse_correcte) {
        resultDiv.innerHTML = '<p class="correct">✅ Bonne réponse !</p>';
    } else {
        let feedback = `<p class="incorrect">❌ Faux. La bonne réponse était : <strong>${questionData.reponse_correcte}</strong>.</p>`;
        if (questionData.explication) {
            feedback += `<p>Explication : ${questionData.explication}</p>`;
        }
        resultDiv.innerHTML = feedback;
    }

    // Afficher le bouton pour passer à la suite
    document.getElementById('next-question-btn').style.display = 'block';
}

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
        const response = await callGeminiAPI(prompt);
        
        resultDiv.innerHTML = `<div class="ia-feedback">${response}</div>`;
        document.getElementById('next-question-btn').style.display = 'block';

    } catch (error) {
        console.error("Erreur de l'API Gemini:", error);
        resultDiv.innerHTML = '<p class="error">❌ Erreur de connexion à l\'IA. Vérifiez votre clé API ou l\'état du service.</p>';
    }
}

// --- Fonction d'appel à l'API Gemini ---

async function callGeminiAPI(prompt) {
    const response = await fetch(config.GEMINI_API_URL + config.GEMINI_API_KEY, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
        }),
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Vérification basique pour s'assurer que la réponse contient du texte
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        return data.candidates[0].content.parts[0].text;
    } else {
        // Gérer les cas où l'API renvoie une erreur ou une réponse vide
        console.error("Réponse de l'API incomplète:", data);
        return "L'IA n'a pas pu générer de correction pour le moment.";
    }
}

// --- Navigation ---

function nextQuestion() {
    // Nettoyer la zone de feedback
    document.getElementById('correction-feedback').innerHTML = '';
    document.getElementById('next-question-btn').style.display = 'none';

    currentQuestionIndex++;
    displayCurrentQuestion();
      }
