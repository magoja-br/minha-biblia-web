document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, iniciando aplicação com Google Cloud TTS');

    // --- COLE A SUA CHAVE DE API DO GOOGLE CLOUD AQUI ---
    // const apiKey = "chave"; // REMOVIDA OU COMENTADA // <<< SUA CHAVE AQUI
    // --- VOZ DE MÁXIMA QUALIDADE (MASCULINA NEUTRA) ---
    const NOME_DA_VOZ = 'pt-BR-Chirp3-HD-Algieba';
    // --- CONTROLE DE VELOCIDADE ---
    let taxaDeFala = 1.0;

    const cabecalho = document.querySelector('header');
    const livroSelect = document.getElementById('livro-select');
    const capituloSelect = document.getElementById('capitulo-select');
    const areaLeitura = document.getElementById('leitura');

    let indiceVersiculoAtual = 0;
    let versiculosDoCapituloElementos = [];
    let dadosVersiculosAtuais = [];
    let estadoLeitura = 'parado'; // Estados: 'parado', 'tocando', 'pausado'
    let audioAtual = null;
    let timeoutLimpezaAudio = null; // Timer para limpeza segura
    let abortController = null; // Para cancelar fetches pendentes
    let isAudioPlaying = false; // Flag específica para saber se o áudio está ativamente tocando
    let isProcessingAudio = false; // Flag para bloquear ações durante a busca/início do áudio

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

    // Listener para garantir a limpeza se a janela for fechada durante a fala
    window.addEventListener('beforeunload', () => {
        pararLeitura(true); // Cancela qualquer fala pendente
    });

    function iniciarLeituraDePontoEspecifico(event) {
        if (isProcessingAudio) return; // Ignora se estiver ocupado
        const versiculoClicado = event.target.closest('.versiculo');
        if (!versiculoClicado || !versiculosDoCapituloElementos.length) return;

        const novoIndice = Array.from(versiculosDoCapituloElementos).indexOf(versiculoClicado);
        console.log(`Clique detectado no versículo índice: ${novoIndice}`);
        if (novoIndice !== -1) {
            pararLeitura(false); // Para áudio atual, NÃO reseta índice para 0
            indiceVersiculoAtual = novoIndice; // Define o novo ponto de partida

            // Define o estado e atualiza o botão ANTES de iniciar a leitura
            estadoLeitura = 'tocando';
            const btn = document.getElementById('play-pause-btn');
            if(btn) btn.innerHTML = '⏸️';
            console.log(`Iniciando leitura a partir do índice ${indiceVersiculoAtual}`);
            lerProximoVersiculo(); // Inicia o ciclo daqui
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
            const playerContainer = document.getElementById('player-container');
            if(playerContainer) playerContainer.remove();
            return;
        }

        const nomeLivro = livroSelect.value;
        const numeroCapitulo = parseInt(capituloSelect.value);
        console.log(`Carregando ${nomeLivro} capítulo ${numeroCapitulo}`);

        const livro = todosOsLivros.find(l => l.nome === nomeLivro);
        const capitulo = livro ? livro.capitulos.find(c => c.capitulo === numeroCapitulo) : null;

        // Cria o painel de controle APENAS se o capítulo for encontrado
        if(capitulo && capitulo.versiculos && capitulo.versiculos.length > 0){
            const playerHtml = `<div id="player-container" class="player-controls"><button id="play-pause-btn" class="player-button" title="Tocar / Pausar">▶️</button><button id="stop-btn" class="player-button" title="Parar">⏹️</button></div>`;
            const navElement = cabecalho.querySelector('nav');
            if(navElement) navElement.insertAdjacentHTML('afterend', playerHtml);
            else cabecalho.insertAdjacentHTML('beforeend', playerHtml);

            // Adiciona listeners aos botões SÓ se foram criados
            document.getElementById('play-pause-btn').addEventListener('click', tocarPausarLeitura);
            document.getElementById('stop-btn').addEventListener('click', () => pararLeitura(true));
            console.log("Painel de controle adicionado.");
        } else {
             console.log("Capítulo sem versículos, painel de controle não será adicionado.");
        }


        if (capitulo && capitulo.versiculos && capitulo.versiculos.length > 0) {
            console.log(`Capítulo possui ${capitulo.versiculos.length} versículos`);
            dadosVersiculosAtuais = capitulo.versiculos;

            capitulo.versiculos.forEach((v, index) => { // Adiciona índice aqui
                const p = document.createElement('p');
                p.className = 'versiculo';
                p.dataset.index = index; // Adiciona índice como data attribute
                p.innerHTML = `<span class="numero-versiculo">${v.versiculo}</span><span class="texto-versiculo">${v.texto}</span>`;
                areaLeitura.appendChild(p);
            });
            versiculosDoCapituloElementos = areaLeitura.querySelectorAll('.versiculo'); // Atualiza a lista de elementos DOM
        } else {
            console.warn(`Versículos não encontrados para ${nomeLivro} ${numeroCapitulo}`);
            areaLeitura.insertAdjacentHTML('beforeend', '<p class="aviso">Capítulo não encontrado ou sem versículos.</p>');
        }
    }

    function tocarPausarLeitura() {
        if (isProcessingAudio) {
             console.warn("Play/Pause ignorado: processando áudio.");
             return; // Ignora se já estiver processando
        }
        const btn = document.getElementById('play-pause-btn');
        if (!btn) { console.error("Botão Play/Pause não encontrado!"); return; }

        // Cancela qualquer limpeza pendente ao interagir
        if(timeoutLimpezaAudio) {
            console.log("Cancelando timeout de limpeza ao clicar Play/Pause.");
            clearTimeout(timeoutLimpezaAudio);
            timeoutLimpezaAudio = null;
        }

        if (estadoLeitura === 'tocando') {
            console.log("Pausando leitura");
            pausarLeitura();
        } else { // Se estava 'parado' ou 'pausado'
            console.log("Iniciando/Retomando leitura");
            estadoLeitura = 'tocando';
            btn.innerHTML = '⏸️';
            isProcessingAudio = true; // Bloqueia botões
            toggleControlButtons(true); // Desabilita botões temporariamente

            if (audioAtual && audioAtual.paused && !isAudioPlaying) {
                console.log("Retomando áudio pausado...");
                audioAtual.play().then(() => {
                    console.log("Retomada do play bem-sucedida.");
                    isAudioPlaying = true;
                    isProcessingAudio = false; // Libera após iniciar
                    toggleControlButtons(false); // Reabilita botões
                    if (versiculosDoCapituloElementos[indiceVersiculoAtual]) {
                        // Remove destaque de todos e aplica no atual
                        document.querySelectorAll('.lendo-agora').forEach(el => el.classList.remove('lendo-agora'));
                        versiculosDoCapituloElementos[indiceVersiculoAtual].classList.add('lendo-agora');
                    }
                }).catch(e => {
                    console.error("Erro ao retomar play:", e);
                    isProcessingAudio = false; // Libera em caso de erro
                    toggleControlButtons(false);
                    pararLeitura(false);
                    alert("Erro ao retomar a leitura. Tente novamente.");
                });
            } else {
                console.log("Iniciando ciclo 'lerProximoVersiculo' a partir do índice:", indiceVersiculoAtual);
                // O próprio lerProximoVersiculo agora vai liberar o isProcessingAudio e toggleControlButtons
                lerProximoVersiculo();
            }
        }
    }

    function pausarLeitura() {
        console.log("Função pausarLeitura chamada");
        estadoLeitura = 'pausado';
        isAudioPlaying = false; // Garante que isAudioPlaying seja false ao pausar

        if(timeoutLimpezaAudio) {
            console.log("Cancelando timeout de limpeza ao Pausar.");
            clearTimeout(timeoutLimpezaAudio);
            timeoutLimpezaAudio = null;
        }

        if (audioAtual && !audioAtual.paused) {
            console.log("Pausando audioAtual");
            audioAtual.pause();
        } else {
            console.log("Pausar chamado, mas áudio não estava tocando ou não existe.");
        }

        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.innerHTML = '▶️';
        const versiculoLendo = document.querySelector('.lendo-agora');
        if (versiculoLendo) {
            versiculoLendo.classList.remove('lendo-agora');
        }
        // Garante que os botões estejam habilitados ao pausar
        isProcessingAudio = false;
        toggleControlButtons(false);
    }

    // --- FUNÇÃO PARAR LEITURA (COM CANCELAMENTO DE FETCH) ---
    function pararLeitura(resetarIndice = false) {
        console.log(`Parando leitura, resetarIndice: ${resetarIndice}, estado ANTES: ${estadoLeitura}`);

        estadoLeitura = 'parado';
        isAudioPlaying = false;

        // Cancela fetch pendente se existir
        if (abortController) {
            console.log("Abortando fetch TTS pendente.");
            abortController.abort();
            abortController = null;
        }

        // Limpa o timeout de limpeza, se existir
        if(timeoutLimpezaAudio) {
            console.log("Cancelando timeout de limpeza anterior.");
            clearTimeout(timeoutLimpezaAudio);
            timeoutLimpezaAudio = null;
        }

        const audioParaLimpar = audioAtual;
        audioAtual = null; // Anula a referência global IMEDIATAMENTE

        if (audioParaLimpar) {
            console.log("Iniciando processo de parada para audioParaLimpar existente.");
            audioParaLimpar.onended = null;
            audioParaLimpar.onerror = null;

            if (!audioParaLimpar.paused) {
                try {
                    audioParaLimpar.pause();
                    console.log("Audio pausado imediatamente.");
                } catch (e) {
                    console.warn("Erro ao pausar áudio durante limpeza (ignorado):", e);
                }
            }

            console.log("Agendando limpeza final do áudio anterior...");
            const urlParaRevogar = (audioParaLimpar.src && audioParaLimpar.src.startsWith('blob:')) ? audioParaLimpar.src : null;

            // Usa setTimeout para garantir que a limpeza ocorra depois que a pausa for processada
            setTimeout(() => {
                console.log("Executando limpeza final atrasada.");
                if (urlParaRevogar) {
                    try {
                        URL.revokeObjectURL(urlParaRevogar);
                        console.log("Object URL revogado (atrasado):", urlParaRevogar);
                    } catch (e) { console.warn("Erro ao revogar Object URL (atrasado, ignorado):", e); }
                }
                // Tenta limpar a src para liberar recursos, mesmo que já não seja a referência global
                try {
                    if (audioParaLimpar) audioParaLimpar.src = '';
                } catch(e) { console.warn("Erro (ignorado) ao limpar src do áudio:", e); }
            }, 300); // Delay para limpeza
        } else {
            console.log("Nenhum audioParaLimpar para limpar.");
        }

        if (resetarIndice) {
            console.log("Resetando índice para 0.");
            indiceVersiculoAtual = 0;
            // Scroll para o início da área de leitura ao resetar
            areaLeitura.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Remove destaque visual
        const versiculoLendo = document.querySelector('.lendo-agora');
        if (versiculoLendo) {
            versiculoLendo.classList.remove('lendo-agora');
            console.log("Highlight removido do versículo atual.");
        }

        // Atualiza o botão play/pause
        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.innerHTML = '▶️';

        // Garante que o processamento seja liberado e os botões habilitados
        isProcessingAudio = false;
        toggleControlButtons(false);

        console.log(`Leitura parada. Índice final: ${indiceVersiculoAtual}`);
    }
    // --- FIM DA FUNÇÃO PARAR LEITURA ---

    // Função para desabilitar/habilitar botões durante o processamento
    function toggleControlButtons(disabled) {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const stopBtn = document.getElementById('stop-btn');
        if(playPauseBtn) playPauseBtn.disabled = disabled;
        if(stopBtn) stopBtn.disabled = disabled;
    }


    // --- FUNÇÃO DE AVANÇO PARA O PRÓXIMO VERSÍCULO ---
    async function lerProximoVersiculo() {
        // Verifica se ainda deve tocar (pode ter sido parado/pausado enquanto preparava)
        if (estadoLeitura !== 'tocando') {
             console.log("lerProximoVersiculo chamado, mas estado não é 'tocando'. Parando.");
             isProcessingAudio = false; // Libera o bloqueio
             toggleControlButtons(false); // Habilita botões
             return;
        }

        // Verifica limites do array
        if (indiceVersiculoAtual >= dadosVersiculosAtuais.length) {
            console.log('Fim do texto alcançado.');
            pararLeitura(true); // Para e reseta o índice
            alert("Leitura do capítulo concluída!");
            isProcessingAudio = false; // Libera o bloqueio
            toggleControlButtons(false); // Habilita botões
            return;
        }

        const versiculoElementoAtual = versiculosDoCapituloElementos[indiceVersiculoAtual];
        const dadosVersiculo = dadosVersiculosAtuais[indiceVersiculoAtual];
        if (!dadosVersiculo || typeof dadosVersiculo.texto === 'undefined') {
            console.error(`Erro: Dados inválidos para o índice ${indiceVersiculoAtual}. Parando.`);
            pararLeitura(true);
            isProcessingAudio = false; // Libera o bloqueio
            toggleControlButtons(false); // Habilita botões
            return;
        }
        const textoParaLer = dadosVersiculo.texto;

        // Adiciona destaque e scroll ANTES de chamar a API
        if(versiculoElementoAtual) {
            document.querySelectorAll('.lendo-agora').forEach(el => el.classList.remove('lendo-agora'));
            versiculoElementoAtual.classList.add('lendo-agora');
            console.log(`Highlight adicionado ao índice ${indiceVersiculoAtual}`);
            versiculoElementoAtual.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
             console.warn(`Elemento DOM não encontrado para o índice ${indiceVersiculoAtual}`);
        }

        try {
            // Define o callback que será chamado quando o áudio terminar
            const onAudioEndCallback = () => {
                console.log(`onAudioEndCallback: Áudio do índice ${indiceVersiculoAtual} terminou. Estado atual: ${estadoLeitura}`);
                isAudioPlaying = false; // Áudio terminou

                // Remove destaque do versículo que acabou de tocar
                if (versiculoElementoAtual) {
                    versiculoElementoAtual.classList.remove('lendo-agora');
                }

                if (estadoLeitura === 'tocando') {
                    indiceVersiculoAtual++; // Avança para o próximo
                    // Chama o próximo ciclo (com um pequeno delay opcional)
                    setTimeout(() => lerProximoVersiculo(), 100); // Pequena pausa antes do próximo
                } else {
                    console.log(`onAudioEndCallback: Estado mudou para ${estadoLeitura}. Interrompendo ciclo.`);
                    isProcessingAudio = false; // Libera bloqueio se parou aqui
                    toggleControlButtons(false); // Habilita botões
                }
            };

            console.log(`Iniciando chamada ao backend para índice ${indiceVersiculoAtual}`);
            // A função lerTexto agora retorna uma promessa que resolve ao fim do áudio
            await lerTexto(textoParaLer, onAudioEndCallback); // Passa o callback

        } catch (error) {
            // Erros vindos da função lerTexto (rede, backend, reprodução)
            console.error(`Erro capturado no ciclo lerProximoVersiculo (índice ${indiceVersiculoAtual}):`, error.message);
            if (versiculoElementoAtual) versiculoElementoAtual.classList.remove('lendo-agora');
            // pararLeitura já foi chamado dentro do catch de lerTexto
            // Apenas garantimos que o bloqueio seja liberado
            isProcessingAudio = false;
            toggleControlButtons(false);
        }
    }
    // --- FIM DA FUNÇÃO DE AVANÇO ---


    // *** ESTA É A FUNÇÃO MODIFICADA (adaptada do script anterior) ***
    // Recebe o texto e o callback a ser executado quando o áudio terminar
    function lerTexto(texto, onEndedCallback) { // Renomeado de tocarAudio para lerTexto

        // Se já estiver processando outro áudio, cancela
        if (isProcessingAudio && abortController) {
             console.warn("Já processando áudio, abortando fetch anterior.");
             abortController.abort();
             // Não reseta isProcessingAudio aqui, a nova chamada continua
        } else if (isAudioPlaying && audioAtual) {
            console.warn("Áudio já estava tocando, parando antes de iniciar novo.");
            pararLeitura(false); // Para, mas não reseta o índice
        }

        isProcessingAudio = true; // Bloqueia novas ações
        toggleControlButtons(true); // Desabilita botões

        // Cria um novo AbortController para esta chamada específica
        abortController = new AbortController();
        const signal = abortController.signal;

        // Limpa texto (opcional, mas recomendado)
        const textoSanitizado = texto.trim(); // Simples trim aqui
        if (!textoSanitizado) {
             console.warn("Texto vazio fornecido para lerTexto.");
             isProcessingAudio = false;
             toggleControlButtons(false);
             return Promise.resolve(); // Resolve imediatamente se texto vazio
        }

        // Dados para enviar ao backend
        const bodyParaBackend = {
            text: textoSanitizado,
            voice: NOME_DA_VOZ, // Usando a constante definida no início do script
            speed: taxaDeFala   // Usando a variável global de velocidade
        };

        // URL do backend (ajustar se necessário para deploy)
        const backendUrl = 'https://meu-proxy-tts.onrender.com/synthesize';

        console.log("Enviando texto para backend:", backendUrl, bodyParaBackend);

        // Faz a chamada ao backend
        return fetch(backendUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyParaBackend),
            signal: signal // Passa o signal para poder abortar
        })
        .then(res => {
            console.log("Resposta recebida do backend, status:", res.status);
             // Limpa o AbortController após receber a resposta (sucesso ou erro)
             abortController = null;

            if (!res.ok) {
                // Tenta obter mensagem de erro do backend
                return res.json().catch(() => null).then(errData => {
                    const errorMessage = errData?.error || `Erro do backend: ${res.status} ${res.statusText}`;
                    console.error("Erro na resposta do backend:", errorMessage);
                    throw new Error(errorMessage);
                });
            }
            return res.json();
        })
        .then(data => {
            // Verifica se o estado ainda é 'tocando' APÓS o fetch ter retornado
             if (estadoLeitura !== 'tocando') {
                 console.warn("Estado mudou durante fetch/processamento TTS. Ignorando resposta e não tocando áudio.");
                 isProcessingAudio = false; // Libera
                 toggleControlButtons(false); // Habilita botões
                 throw new Error("Leitura interrompida antes de tocar."); // Rejeita a promessa
             }

            if (data.audioContent) {
                console.log("AudioContent recebido do backend.");
                const audioBlob = b64toBlob(data.audioContent, 'audio/mp3');
                const audioUrl = URL.createObjectURL(audioBlob);
                console.log(`Blob URL criado: ${audioUrl}`);

                // Limpeza do áudio anterior ANTES de criar o novo
                if (audioAtual) {
                    console.warn("Limpando referência de áudio anterior antes de criar novo.");
                    pararLeitura(false); // Chama a função de parada para limpar recursos
                }

                // Cria o novo objeto Audio
                audioAtual = new Audio(audioUrl);
                console.log("Novo objeto audioAtual criado:", audioAtual);
                isAudioPlaying = false; // Ainda não está tocando

                // Retorna uma promessa que resolve ou rejeita baseada nos eventos do áudio
                return new Promise((resolve, reject) => {
                    // Função a ser chamada quando o áudio terminar NATURALMENTE
                    const handleEnded = () => {
                        console.log(`Evento 'ended' disparado para o áudio.`);
                        isAudioPlaying = false; // Não está mais tocando

                        // Limpa a referência global se ainda for este áudio
                        if (audioAtual && audioAtual.src === audioUrl) {
                             audioAtual = null;
                             console.log("Referência global audioAtual anulada em ended.");
                        } else if (!audioAtual) {
                             console.log("Referência global audioAtual já era null em ended.");
                        } else {
                            console.warn("handleEnded: audioAtual global mudou antes do fim deste áudio!");
                        }


                        // Libera o Blob URL
                        try { URL.revokeObjectURL(audioUrl); console.log("Blob URL revogado em ended:", audioUrl); }
                        catch(e) { console.warn("Erro ao revogar Blob URL em ended (ignorado):", e); }

                        // Remove os listeners deste áudio específico
                        this.removeEventListener('ended', handleEnded);
                        this.removeEventListener('error', handleError);

                        // Chama o callback fornecido (que geralmente chama lerProximoVersiculo)
                        if (onEndedCallback) {
                             console.log("Chamando onEndedCallback...");
                             onEndedCallback();
                        }
                        resolve(); // Resolve a promessa da função lerTexto
                    };

                    // Função para lidar com erros durante o carregamento ou reprodução
                    const handleError = (e) => {
                        console.error("Erro no elemento Audio:", e);
                        isAudioPlaying = false;
                        isProcessingAudio = false; // Libera o bloqueio em caso de erro

                        // Limpa a referência global se ainda for este áudio
                         if (audioAtual && audioAtual.src === audioUrl) {
                              audioAtual = null;
                              console.log("Referência global audioAtual anulada em error.");
                         } else {
                              console.warn("handleError: audioAtual global mudou ou já era null.");
                         }

                        // Libera o Blob URL
                        try { URL.revokeObjectURL(audioUrl); console.log("Blob URL revogado em error:", audioUrl); }
                        catch(err) { console.warn("Erro ao revogar Blob URL em error (ignorado):", err); }

                        // Remove os listeners
                        this.removeEventListener('ended', handleEnded);
                        this.removeEventListener('error', handleError);

                        toggleControlButtons(false); // Habilita botões
                        alert("Erro ao carregar ou reproduzir o áudio.");
                        reject(e); // Rejeita a promessa da função lerTexto
                    };

                    // Adiciona os listeners ao NOVO objeto audioAtual
                    audioAtual.addEventListener('ended', handleEnded);
                    audioAtual.addEventListener('error', handleError);

                    // Tenta iniciar a reprodução
                    console.log("Tentando iniciar playback...");
                    audioAtual.play().then(() => {
                        console.log("Playback iniciado com sucesso via play().then()");
                        isAudioPlaying = true; // Agora está tocando
                        isProcessingAudio = false; // Processamento (busca e início) concluído
                        toggleControlButtons(false); // Habilita os botões novamente
                        // A promessa só resolverá quando o áudio terminar (via handleEnded)
                    }).catch(playError => {
                        // Erro específico ao tentar dar play (ex: navegador bloqueou autoplay)
                        console.error("Erro direto ao chamar audio.play():", playError);
                        handleError(playError); // Chama o handler de erro geral
                    });
                });

            } else {
                // Backend respondeu OK mas não enviou audioContent
                console.error("Resposta do backend OK, mas sem audioContent:", data);
                throw new Error("Resposta do backend inválida (sem audioContent)");
            }
        })
        .catch(error => {
            // Captura erros de rede (fetch falhou) ou erros lançados nos '.then'
            // Também captura o erro se o fetch foi abortado
            if (error.name === 'AbortError') {
                console.log('Chamada ao backend foi abortada (provavelmente por clique em Parar ou novo Play).');
            } else {
                alert(`Não foi possível obter o áudio do servidor: ${error.message}`);
                console.error("Erro durante a chamada ao backend ou processamento da resposta:", error);
            }

            // Garante a liberação do estado e botões em qualquer caso de erro
            isAudioPlaying = false;
            isProcessingAudio = false;
            toggleControlButtons(false);
            if (abortController) abortController = null; // Limpa controller se ainda existir

            // Rejeita a promessa para que lerProximoVersiculo saiba que falhou
            return Promise.reject(error);
        });
    }
    // *** FIM DA FUNÇÃO MODIFICADA ***


    // Função auxiliar para converter Base64 para Blob
    function b64toBlob(b64Data, contentType='') {
        try {
            const sliceSize = 512;
            const byteCharacters = atob(b64Data);
            const byteArrays = [];
            for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
                const slice = byteCharacters.slice(offset, offset + sliceSize);
                const byteNumbers = new Array(slice.length);
                for (let i = 0; i < slice.length; i++) { byteNumbers[i] = slice.charCodeAt(i); }
                const byteArray = new Uint8Array(byteNumbers);
                byteArrays.push(byteArray);
            }
            return new Blob(byteArrays, {type: contentType});
        } catch (e) {
             console.error("Erro ao converter Base64 para Blob:", e);
             throw new Error("Falha ao decodificar dados de áudio."); // Lança erro para ser pego
        }
    }

    // --- CONEXÃO DO SLIDER DE VELOCIDADE ---
    const taxaFalaInput = document.getElementById('taxa-fala');
    const taxaFalaLabel = document.querySelector('.velocidade-control label');

    // Inicializa a label com o valor padrão do slider
    if (taxaFalaInput && taxaFalaLabel) {
        taxaDeFala = parseFloat(taxaFalaInput.value); // Garante que taxaDeFala tem o valor inicial
        taxaFalaLabel.textContent = `Velocidade (${taxaDeFala.toFixed(2)}x)`;
    }

    taxaFalaInput.addEventListener('input', (event) => {
        taxaDeFala = parseFloat(event.target.value);
        if (taxaFalaLabel) {
            taxaFalaLabel.textContent = `Velocidade (${taxaDeFala.toFixed(2)}x)`;
        }
        console.log(`Velocidade de fala ajustada para: ${taxaDeFala}x`);

        // Se estava tocando ou pausado, para e reinicia a leitura do versículo atual com nova velocidade
        if (estadoLeitura === 'tocando' || estadoLeitura === 'pausado') {
            const indiceDeRetomada = indiceVersiculoAtual; // Guarda o índice atual
            pararLeitura(false); // Para o áudio, mantém o índice
            indiceVersiculoAtual = indiceDeRetomada; // Restaura o índice

            // Define estado para tocar e atualiza botão
            estadoLeitura = 'tocando';
            const btn = document.getElementById('play-pause-btn');
            if(btn) btn.innerHTML = '⏸️';

            // Adiciona um pequeno delay para garantir que a parada foi processada
            setTimeout(() => {
                // Verifica novamente o estado antes de reiniciar
                if (estadoLeitura === 'tocando') {
                    console.log("Reiniciando leitura do versículo atual após ajuste de velocidade.");
                    lerProximoVersiculo(); // Reinicia o ciclo a partir do mesmo versículo
                } else {
                    console.log("Estado mudou após ajuste de velocidade, não reiniciando.");
                }
            }, 300); // Delay pode ser ajustado
        }
    });
    // --- FIM DA CONEXÃO DO SLIDER ---

    // Inicia o processo carregando a lista de livros
    popularLivros();

}); // Fecha o DOMContentLoaded