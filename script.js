document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, iniciando aplicação'); 

    // --- COLE AS SUAS CHAVES AQUI (Obrigatório para o áudio) ---
    const SUA_CHAVE_API_ELEVENLABS = 'sk_ef38aaff55cddf8e62082e4e9e1ad7160f76f9363c430306'; // Substitua pela sua chave real
    const ID_DA_VOZ = 'zNsotODqUhvbJ5wMG7Ei'; // Substitua pelo ID da voz real
    // --- FIM DAS CHAVES ---

    const cabecalho = document.querySelector('header');
    const livroSelect = document.getElementById('livro-select');
    const capituloSelect = document.getElementById('capitulo-select');
    const areaLeitura = document.getElementById('leitura');

    let indiceVersiculoAtual = 0;
    let versiculosDoCapituloElementos = []; 
    let dadosVersiculosAtuais = [];       
    let estadoLeitura = 'parado'; // Estados: 'parado', 'tocando', 'pausado'
    let audioAtual = null; 

    // 1. VERIFICAÇÃO DE DADOS (CRÍTICA)
    if (typeof bibliaData === 'undefined') {
        console.error('Erro crítico: bibliaData não está definido.');
        areaLeitura.innerHTML = `<p class="aviso" style="color:red; font-weight:bold; padding:20px;">ERRO: Não foi possível carregar os dados da Bíblia. Verifique a sintaxe do arquivo biblia.js.</p>`;
        return; 
    } else {
        console.log('bibliaData carregado com sucesso');
    }
    
    const todosOsLivros = [...bibliaData.antigoTestamento, ...bibliaData.novoTestamento];
    console.log(`Total de livros carregados: ${todosOsLivros.length}`);

    // Eventos principais
    livroSelect.addEventListener('change', popularCapitulos);
    capituloSelect.addEventListener('change', exibirCapitulo);
    areaLeitura.addEventListener('click', iniciarLeituraDePontoEspecifico);

    function iniciarLeituraDePontoEspecifico(event) {
        const versiculoClicado = event.target.closest('.versiculo');
        if (!versiculoClicado) return;
        const novoIndice = Array.from(versiculosDoCapituloElementos).indexOf(versiculoClicado);
        console.log(`Clique detectado no versículo índice: ${novoIndice}`);
        if (novoIndice !== -1) {
            // Para qualquer leitura anterior e reseta o índice para o clicado
            pararLeitura(false); // Não reseta para 0, mantém o novo índice
            indiceVersiculoAtual = novoIndice; 
            
            // Inicia a leitura a partir deste ponto
            estadoLeitura = 'tocando'; 
             const btn = document.getElementById('play-pause-btn');
             if(btn) btn.innerHTML = '⏸️'; 
            console.log(`Iniciando leitura a partir do índice ${indiceVersiculoAtual}`);
            lerProximoVersiculo(); 
        }
    }
    
    function popularLivros() {
        console.log("Populando lista de livros");
        livroSelect.innerHTML = '<option value="">Selecione um Livro</option>'; 
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
        console.log(`Livro selecionado: ${nomeLivroSelecionado}`);
        capituloSelect.innerHTML = ''; 
        const livro = todosOsLivros.find(l => l.nome === nomeLivroSelecionado);
        if (livro && livro.capitulos) {
            console.log(`Carregando ${livro.capitulos.length} capítulos para ${nomeLivroSelecionado}`);
            livro.capitulos.forEach(cap => {
                const option = document.createElement('option');
                option.value = cap.capitulo;
                option.textContent = `Capítulo ${cap.capitulo}`;
                capituloSelect.appendChild(option);
            });
        } else if(nomeLivroSelecionado){ 
            console.warn(`Nenhum capítulo encontrado para ${nomeLivroSelecionado}`);
        }
        exibirCapitulo(); 
    }
    function exibirCapitulo() {
        console.log("Exibindo capítulo");
        pararLeitura(true); // Para e reseta TUDO ao mudar de capítulo
        
        areaLeitura.innerHTML = ''; 
        versiculosDoCapituloElementos = [];
        dadosVersiculosAtuais = [];
        const painelControleAntigo = document.getElementById('player-container');
        if (painelControleAntigo) painelControleAntigo.remove();

        if (!livroSelect.value || !capituloSelect.value) {
             console.log("Seleção de livro ou capítulo inválida para exibição.");
             areaLeitura.innerHTML = '<p class="aviso">Selecione um livro e capítulo para começar a leitura.</p>'; 
             // Garante que o player não seja adicionado se não houver capítulo
             return; 
        }

        const nomeLivro = livroSelect.value;
        const numeroCapitulo = parseInt(capituloSelect.value);
         console.log(`Carregando ${nomeLivro} capítulo ${numeroCapitulo}`);

        const livro = todosOsLivros.find(l => l.nome === nomeLivro);
        const capitulo = livro ? livro.capitulos.find(c => c.capitulo === numeroCapitulo) : null;
        
        // Adiciona o player APENAS se houver um capítulo válido
        const playerHtml = `<div id="player-container" class="player-controls"><button id="play-pause-btn" class="player-button" title="Tocar / Pausar">▶️</button><button id="stop-btn" class="player-button" title="Parar">⏹️</button></div>`;
        cabecalho.insertAdjacentHTML('beforeend', playerHtml);
        document.getElementById('play-pause-btn').addEventListener('click', tocarPausarLeitura);
        document.getElementById('stop-btn').addEventListener('click', () => pararLeitura(true)); // Botão stop sempre reseta
        
        if (capitulo && capitulo.versiculos) {
             console.log(`Capítulo possui ${capitulo.versiculos.length} versículos`);
            dadosVersiculosAtuais = capitulo.versiculos; 
            
            capitulo.versiculos.forEach(v => {
                const p = document.createElement('p');
                p.className = 'versiculo';
                p.innerHTML = `<span class="numero-versiculo">${v.versiculo}</span><span class="texto-versiculo">${v.texto}</span>`;
                areaLeitura.appendChild(p);
            });
            versiculosDoCapituloElementos = areaLeitura.querySelectorAll('.versiculo'); 
        } else {
             console.warn(`Versículos não encontrados para ${nomeLivro} ${numeroCapitulo}`);
            areaLeitura.insertAdjacentHTML('beforeend', '<p class="aviso">Capítulo não encontrado ou sem versículos.</p>');
        }
    }
    
    function tocarPausarLeitura() {
        const btn = document.getElementById('play-pause-btn');
        if (!btn) { console.error("Botão Play/Pause não encontrado!"); return; } 

        if (estadoLeitura === 'tocando') {
            console.log("Pausando leitura");
            pausarLeitura();
        } else { // Se estava 'parado' ou 'pausado'
             console.log("Iniciando/Retomando leitura");
             // Define o estado ANTES de qualquer operação assíncrona
             estadoLeitura = 'tocando'; 
             btn.innerHTML = '⏸️';
            
            if (audioAtual && audioAtual.paused) {
                 console.log("Retomando áudio pausado");
                 // Apenas dá play. O ciclo continua de onde parou.
                audioAtual.play();
                if (versiculosDoCapituloElementos[indiceVersiculoAtual]) {
                    versiculosDoCapituloElementos[indiceVersiculoAtual].classList.add('lendo-agora');
                }
            } else {
                 console.log("Iniciando ciclo 'lerProximoVersiculo' a partir do índice:", indiceVersiculoAtual);
                 // Inicia o ciclo de leitura a partir do índice atual
                lerProximoVersiculo();
            }
        }
    }
    
    function pausarLeitura() {
         console.log("Função pausarLeitura chamada");
         // Muda o estado ANTES de pausar o áudio
         estadoLeitura = 'pausado'; 
        if (audioAtual) {
             console.log("Pausando audioAtual");
             audioAtual.pause();
        }
        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.innerHTML = '▶️';
        const versiculoLendo = document.querySelector('.lendo-agora');
        if (versiculoLendo) {
            versiculoLendo.classList.remove('lendo-agora');
        }
    }

    // --- FUNÇÃO PARAR LEITURA REFINADA E SEGURA ---
    function pararLeitura(resetarIndice = false) {
         console.log(`Parando leitura, resetarIndice: ${resetarIndice}, estado ANTES: ${estadoLeitura}`);
         
         // Define o estado como 'parado' PRIMEIRO
         estadoLeitura = 'parado'; 

         // Limpa o áudio existente de forma segura
         if (audioAtual) {
             console.log("Parando e limpando audioAtual existente.");
             // Remove listeners PRIMEIRO para evitar chamadas fantasmas
             audioAtual.onended = null; 
             audioAtual.onerror = null;
             audioAtual.pause();
             audioAtual.src = ''; // Força o descarregamento
             audioAtual = null; 
         } else {
              console.log("Nenhum audioAtual para parar.");
         }

        // Garante a remoção do destaque visual
        const versiculoLendo = document.querySelector('.lendo-agora');
        if (versiculoLendo) {
            versiculoLendo.classList.remove('lendo-agora');
        }

        // Reseta o botão play/pause
        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.innerHTML = '▶️'; 

        // Reseta o índice se solicitado
        if(resetarIndice){
            console.log("Resetando indiceVersiculoAtual para 0");
            indiceVersiculoAtual = 0; 
        }
         console.log(`Parada concluída, estado FINAL: ${estadoLeitura}, indice: ${indiceVersiculoAtual}`);
    }
    // --- FIM DA FUNÇÃO PARAR LEITURA REFINADA ---

    // --- FUNÇÃO DE AVANÇO (LÓGICA CENTRAL CORRIGIDA) ---
    async function lerProximoVersiculo() {
         // Verifica o estado logo no início. Se não for 'tocando', interrompe.
         if (estadoLeitura !== 'tocando') {
             console.log(`lerProximoVersiculo: Estado não é 'tocando' (${estadoLeitura}). Interrompendo ciclo.`);
             return; 
         }
        
         console.log(`lerProximoVersiculo: Iniciando índice ${indiceVersiculoAtual}`);

        // Limpa o destaque do versículo anterior
        if (indiceVersiculoAtual > 0 && versiculosDoCapituloElementos[indiceVersiculoAtual - 1]) {
             versiculosDoCapituloElementos[indiceVersiculoAtual - 1].classList.remove('lendo-agora');
        }

        // Condição de parada: Fim do capítulo
        if (indiceVersiculoAtual >= dadosVersiculosAtuais.length) {
             console.log("Fim do capítulo atingido. Parando leitura.");
            pararLeitura(true); 
            return;
        }

        // Pega o elemento HTML e o texto do versículo atual
        const versiculoElementoAtual = versiculosDoCapituloElementos[indiceVersiculoAtual];
        const dadosVersiculo = dadosVersiculosAtuais[indiceVersiculoAtual];
        // Garante que temos os dados antes de tentar ler o texto
        if (!dadosVersiculo || typeof dadosVersiculo.texto === 'undefined') {
             console.error(`Erro: Dados inválidos para o índice ${indiceVersiculoAtual}. Parando.`);
             pararLeitura(true);
             return;
        }
        const textoParaLer = dadosVersiculo.texto; 

        // Adiciona destaque e rola a tela (apenas se o elemento existir)
        if(versiculoElementoAtual) { 
            versiculoElementoAtual.classList.add('lendo-agora'); 
            versiculoElementoAtual.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
        }

        try {
            // Define o callback que será chamado QUANDO o áudio terminar
            const onAudioEndCallback = () => {
                 console.log(`onAudioEndCallback: Áudio do índice ${indiceVersiculoAtual} terminou. Estado atual: ${estadoLeitura}`);
                 // Verifica o estado NOVAMENTE DENTRO DO CALLBACK antes de prosseguir
                 if (estadoLeitura === 'tocando') {
                    indiceVersiculoAtual++; // INCREMENTO ACONTECE AQUI
                    lerProximoVersiculo(); // Chama o próximo
                 } else {
                     console.log(`onAudioEndCallback: Estado mudou para ${estadoLeitura} durante a reprodução ou no final. Interrompendo ciclo.`);
                     // Não chama pararLeitura aqui, pois o estado já foi alterado externamente
                 }
             };

            // Toca o áudio e passa o callback
             console.log(`Iniciando tocarAudio para índice ${indiceVersiculoAtual}`);
            await tocarAudio(textoParaLer, onAudioEndCallback);

        } catch (error) {
            // Se tocarAudio falhar (API error, playback error), ele já chama pararLeitura
            console.error(`Erro no ciclo lerProximoVersiculo (índice ${indiceVersiculoAtual}):`, error);
            // pararLeitura(true) já foi chamado dentro de tocarAudio em caso de erro
        }
    }
    // --- FIM DA FUNÇÃO DE AVANÇO ---


    // --- FUNÇÃO TOCAR ÁUDIO (AGORA RECEBE O CALLBACK E É MAIS SEGURA) ---
    async function tocarAudio(texto, onEndedCallback) {
        // Verifica as chaves
        if (!SUA_CHAVE_API_ELEVENLABS || SUA_CHAVE_API_ELEVENLABS === 'COLE_SUA_CHAVE_AQUI' || !ID_DA_VOZ || ID_DA_VOZ === 'COLE_O_ID_DA_VOZ_AQUI') {
            alert('Por favor, configure sua chave de API e ID da Voz da ElevenLabs no arquivo script.js');
            pararLeitura(true);
            throw new Error("API Keys not set"); 
        }
        
        const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${ID_DA_VOZ}/stream`;

        // Limpa QUALQUER áudio anterior ANTES de fazer a chamada da API
        // Isso evita que um áudio antigo dispare 'onended' tardiamente
        if (audioAtual) {
             console.log("Limpando áudio anterior existente ANTES da chamada da API.");
             audioAtual.pause();
             audioAtual.onended = null;
             audioAtual.onerror = null;
             audioAtual.src = '';
             audioAtual = null; // Garante que está nulo antes de criar o novo
        }


        try {
            console.log("Chamando API da ElevenLabs...");
            const response = await fetch(elevenLabsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'xi-api-key': SUA_CHAVE_API_ELEVENLABS },
                body: JSON.stringify({
                    text: texto,
                    model_id: 'eleven_multilingual_v2',
                    output_format: 'mp3_44100_128',
                    voice_settings: { stability: 0.5, similarity_boost: 0.5 }
                })
            });
             console.log(`Resposta da API: ${response.status}`);

            if (response.ok) {
                const audioBlob = await response.blob(); 
                const audioUrl = URL.createObjectURL(audioBlob); 
                console.log(`audioUrl criado: ${audioUrl}`);

                // Cria o novo objeto de áudio
                audioAtual = new Audio(audioUrl); 
                console.log("Novo audioAtual criado:", audioAtual);

                // --- PONTO CRÍTICO: ADICIONANDO LISTENERS DE FORMA SEGURA ---
                // Define o que fazer quando o áudio terminar
                const handleEnded = () => {
                     console.log(`Evento 'ended' disparado para índice ${indiceVersiculoAtual}. Estado: ${estadoLeitura}`);
                     audioAtual.removeEventListener('ended', handleEnded); // Auto-remove o listener
                     URL.revokeObjectURL(audioUrl); 
                     // Chama o callback APENAS se ainda estivermos no estado 'tocando'
                     if (estadoLeitura === 'tocando' && onEndedCallback) {
                        onEndedCallback(); 
                     }
                };
                audioAtual.addEventListener('ended', handleEnded);
                
                // Define o que fazer em caso de erro
                const handleError = (e) => {
                     console.error("Audio playback error event:", e);
                     audioAtual.removeEventListener('error', handleError); // Auto-remove o listener
                     URL.revokeObjectURL(audioUrl);
                     alert("Erro ao tocar o áudio. Verifique a conexão ou o console.");
                     pararLeitura(true); // Para tudo
                };
                audioAtual.addEventListener('error', handleError);
                // --- FIM DO PONTO CRÍTICO ---
                
                console.log("Iniciando playback do audioAtual");
                 try {
                     // Tenta iniciar a reprodução (navegadores podem bloquear)
                     await audioAtual.play();
                     console.log("Playback iniciado com sucesso.");
                 } catch (playError) {
                     console.error("Erro ao tentar dar play no áudio:", playError);
                     alert("Não foi possível iniciar o áudio automaticamente. Clique em Play novamente ou verifique as permissões do navegador.");
                     // Se play falhar, paramos e resetamos para o estado inicial
                     pararLeitura(false); // Não reseta o índice, permite tentar de novo
                     // Rejeita a promise para interromper o ciclo lerProximoVersiculo
                     throw playError; 
                 }
                
            } else { 
                const errorText = await response.text();
                console.error('Erro na API da ElevenLabs:', errorText);
                alert('Erro na API ElevenLabs: ' + errorText);
                pararLeitura(true);
                throw new Error("API Error"); 
            }
        } catch (error) { 
            console.error('Erro geral na função tocarAudio:', error);
            // Garante que parou tudo mesmo se o erro foi antes de criar o audioAtual
            if (estadoLeitura !== 'parado') { // Evita chamar pararLeitura duas vezes desnecessariamente
                 pararLeitura(true); 
            }
            throw error; // Propaga o erro para o ciclo lerProximoVersiculo parar
        }
    }
    // --- FIM DA FUNÇÃO TOCAR ÁUDIO ---
    
    // Inicia o processo carregando a lista de livros
    popularLivros();
});