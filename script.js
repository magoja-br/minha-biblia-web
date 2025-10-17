document.addEventListener('DOMContentLoaded', () => {
    // Cole sua Chave de API do Google Cloud aqui entre as aspas.
    const SUA_CHAVE_API = 'AIzaSyCZncgfC5xGjvezIUled31DKe4xnqVDKDs'; // <<< VERIFIQUE SE SUA CHAVE ESTÁ AQUI

    const cabecalho = document.querySelector('header');
    const livroSelect = document.getElementById('livro-select');
    const capituloSelect = document.getElementById('capitulo-select');
    const areaLeitura = document.getElementById('leitura');

    // Variáveis para controlar o estado da leitura de áudio
    let indiceVersiculoAtual = 0;
    let versiculosDoCapitulo = [];
    let estadoLeitura = 'parado'; // pode ser 'parado', 'tocando', 'pausado'
    let audioAtual = null;

    const todosOsLivros = [...bibliaData.antigoTestamento, ...bibliaData.novoTestamento];

    function popularLivros() {
        todosOsLivros.forEach(livro => {
            const option = document.createElement('option');
            option.value = livro.nome;
            option.textContent = livro.nome;
            livroSelect.appendChild(option);
        });
        popularCapitulos();
    }

    function popularCapitulos() {
        const nomeLivroSelecionado = livroSelect.value;
        const livro = todosOsLivros.find(l => l.nome === nomeLivroSelecionado);
        
        capituloSelect.innerHTML = '';
        if (livro && livro.capitulos) {
            livro.capitulos.forEach(cap => {
                const option = document.createElement('option');
                option.value = cap.capitulo;
                option.textContent = `Capítulo ${cap.capitulo}`;
                capituloSelect.appendChild(option);
            });
        }
        exibirCapitulo();
    }

    function exibirCapitulo() {
        pararLeitura(); // Garante que a leitura pare ao mudar de capítulo
        const nomeLivro = livroSelect.value;
        const numeroCapitulo = parseInt(capituloSelect.value);
        const livro = todosOsLivros.find(l => l.nome === nomeLivro);
        const capitulo = livro ? livro.capitulos.find(c => c.capitulo === numeroCapitulo) : null;

        // Limpa a área de leitura e o painel de controle antigo
        areaLeitura.innerHTML = '';
        const painelControleAntigo = document.getElementById('player-container');
        if (painelControleAntigo) {
            painelControleAntigo.remove();
        }

        // Cria o painel de controle do player
        const playerHtml = `
            <div id="player-container" class="player-controls">
                <button id="play-pause-btn" class="player-button" title="Tocar / Pausar">▶️</button>
                <button id="stop-btn" class="player-button" title="Parar">⏹️</button>
            </div>
        `;
        // Adiciona o novo painel DENTRO do cabeçalho
        cabecalho.insertAdjacentHTML('beforeend', playerHtml);
        
        // Adiciona os eventos aos novos botões
        document.getElementById('play-pause-btn').addEventListener('click', tocarPausarLeitura);
        document.getElementById('stop-btn').addEventListener('click', pararLeitura);

        if (capitulo && capitulo.versiculos) {
            capitulo.versiculos.forEach(v => {
                const p = document.createElement('p');
                p.className = 'versiculo';
                p.innerHTML = `
                    <span class="numero-versiculo">${v.versiculo}</span>
                    <span class="texto-versiculo">${v.texto}</span>
                `;
                areaLeitura.appendChild(p);
            });
            // Armazena os versículos do capítulo atual para o player
            versiculosDoCapitulo = areaLeitura.querySelectorAll('.versiculo');

        } else {
            areaLeitura.insertAdjacentHTML('beforeend', '<p class="aviso">Capítulo não encontrado.</p>');
        }
    }

    function tocarPausarLeitura() {
        const btn = document.getElementById('play-pause-btn');
        if (estadoLeitura === 'tocando') {
            pausarLeitura();
        } else { // Se estiver 'parado' ou 'pausado'
            btn.innerHTML = '⏸️';
            estadoLeitura = 'tocando';
            if (audioAtual && audioAtual.paused) {
                audioAtual.play();
                versiculosDoCapitulo[indiceVersiculoAtual].classList.add('lendo-agora');
            } else {
                lerProximoVersiculo();
            }
        }
    }

    function pausarLeitura() {
        if (audioAtual) {
            audioAtual.pause();
            estadoLeitura = 'pausado';
            document.getElementById('play-pause-btn').innerHTML = '▶️';
            if(versiculosDoCapitulo[indiceVersiculoAtual]) {
                 versiculosDoCapitulo[indiceVersiculoAtual].classList.remove('lendo-agora');
            }
        }
    }

    function pararLeitura() {
        if (audioAtual) {
            audioAtual.pause();
            audioAtual = null;
        }
        if (versiculosDoCapitulo[indiceVersiculoAtual]) {
            versiculosDoCapitulo[indiceVersiculoAtual].classList.remove('lendo-agora');
        }
        estadoLeitura = 'parado';
        indiceVersiculoAtual = 0;
        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.innerHTML = '▶️';
    }

    function lerProximoVersiculo() {
        if (indiceVersiculoAtual > 0 && versiculosDoCapitulo[indiceVersiculoAtual - 1]) {
             versiculosDoCapitulo[indiceVersiculoAtual - 1].classList.remove('lendo-agora');
        }
        if (indiceVersiculoAtual >= versiculosDoCapitulo.length || estadoLeitura !== 'tocando') {
            pararLeitura();
            return;
        }

        const versiculoAtual = versiculosDoCapitulo[indiceVersiculoAtual];
        versiculoAtual.classList.add('lendo-agora');
        versiculoAtual.scrollIntoView({ behavior: 'smooth', block: 'center' }); // Rola a página para o versículo
        const texto = versiculoAtual.querySelector('.texto-versiculo').textContent;
        
        tocarAudio(texto, () => {
            versiculoAtual.classList.remove('lendo-agora');
            indiceVersiculoAtual++;
            lerProximoVersiculo();
        });
    }

    async function tocarAudio(texto, onEndedCallback) {
        if (SUA_CHAVE_API === 'COLE_SUA_CHAVE_AQUI') {
            alert('Por favor, configure sua chave de API no arquivo script.js');
            pararLeitura();
            return;
        }
        try {
            const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${SUA_CHAVE_API}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: { text: texto },
                    voice: { languageCode: 'pt-BR', name: 'pt-BR-Wavenet-B' },
                    audioConfig: { audioEncoding: 'MP3' }
                })
            });
            const data = await response.json();
            if (data.audioContent) {
                audioAtual = new Audio('data:audio/mp3;base64,' + data.audioContent);
                audioAtual.play();
                audioAtual.onended = onEndedCallback;
            } else {
                console.error('Erro na API do Google:', data);
                alert('Não foi possível gerar o áudio.');
                pararLeitura();
            }
        } catch (error) {
            console.error('Erro ao chamar a API:', error);
            alert('Ocorreu um erro ao tentar gerar o áudio.');
            pararLeitura();
        }
    }

    livroSelect.addEventListener('change', popularCapitulos);
    capituloSelect.addEventListener('change', exibirCapitulo);
    
    popularLivros();
});
   