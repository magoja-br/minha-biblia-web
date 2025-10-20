document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, iniciando aplicação com Google Cloud TTS'); 

    // --- COLE A SUA CHAVE DE API DO GOOGLE CLOUD AQUI ---
    const SUA_CHAVE_API_GOOGLE = 'AIzaSyCZncgfC5xGjvezIUled31DKe4xnqVDKDs'; // <<< SUA CHAVE AQUI
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
        const versiculoClicado = event.target.closest('.versiculo');
        if (!versiculoClicado) return;
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

        if(capitulo){
            const playerHtml = `<div id="player-container" class="player-controls"><button id="play-pause-btn" class="player-button" title="Tocar / Pausar">▶️</button><button id="stop-btn" class="player-button" title="Parar">⏹️</button></div>`;
            const navElement = cabecalho.querySelector('nav');
            if(navElement) navElement.insertAdjacentHTML('afterend', playerHtml);
            else cabecalho.insertAdjacentHTML('beforeend', playerHtml);

            document.getElementById('play-pause-btn').addEventListener('click', tocarPausarLeitura);
            document.getElementById('stop-btn').addEventListener('click', () => pararLeitura(true));
        }

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

            if (audioAtual && audioAtual.paused) {
                console.log("Retomando áudio pausado");
                audioAtual.play().then(() => {
                    console.log("Retomada do play bem-sucedida.");
                    if (versiculosDoCapituloElementos[indiceVersiculoAtual]) {
                        // Remove destaque de todos os versículos antes de destacar o atual
                        document.querySelectorAll('.lendo-agora').forEach(el => el.classList.remove('lendo-agora'));
                        versiculosDoCapituloElementos[indiceVersiculoAtual].classList.add('lendo-agora');
                    }
                }).catch(e => {
                    console.error("Erro ao retomar play:", e);
                    pararLeitura(false);
                    alert("Erro ao retomar a leitura. Tente novamente.");
                });
            } else {
                console.log("Iniciando ciclo 'lerProximoVersiculo' a partir do índice:", indiceVersiculoAtual);
                lerProximoVersiculo();
            }
        }
    }

    function pausarLeitura() {
        console.log("Função pausarLeitura chamada");
        estadoLeitura = 'pausado';
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
    }

    // --- FUNÇÃO PARAR LEITURA (COM CANCELAMENTO DE FETCH) ---
    function pararLeitura(resetarIndice = false) {
        console.log(`Parando leitura, resetarIndice: ${resetarIndice}, estado ANTES: ${estadoLeitura}`);

        estadoLeitura = 'parado';

        // Cancela fetch pendente se existir
        if (abortController) {
            console.log("Abortando fetch TTS pendente.");
            abortController.abort();
            abortController = null;
        }

        if(timeoutLimpezaAudio) {
            console.log("Cancelando timeout de limpeza anterior.");
            clearTimeout(timeoutLimpezaAudio);
            timeoutLimpezaAudio = null;
        }

        const audioParaLimpar = audioAtual;

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

            timeoutLimpezaAudio = setTimeout(() => {
                console.log("Executando limpeza final atrasada.");
                
                if (urlParaRevogar) {
                    try {
                        URL.revokeObjectURL(urlParaRevogar);
                        console.log("Object URL revogado (atrasado):", urlParaRevogar);
                    } catch (e) { console.warn("Erro ao revogar Object URL (atrasado, ignorado):", e); }
                }
                try { 
                    if(audioParaLimpar) audioParaLimpar.src = ''; 
                } catch(e) { console.warn("Erro (ignorado) ao limpar src do áudio:", e); }
                
                if (audioAtual === audioParaLimpar) {
                    audioAtual = null;
                    console.log("Referência global audioAtual anulada (atrasado).");
                } else {
                    console.log("audioAtual global já mudou, não anulando.");
                }
            }, 300); // Aumentado para 300ms
        } else {
            console.log("Nenhum audioParaLimpar para limpar.");
        }

        if (resetarIndice) {
            console.log("Resetando índice para 0.");
            indiceVersiculoAtual = 0;
        }

        const versiculoLendo = document.querySelector('.lendo-agora');
        if (versiculoLendo) {
            versiculoLendo.classList.remove('lendo-agora');
            console.log("Highlight removido do versículo atual.");
        }

        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.innerHTML = '▶️';
    }
    // --- FIM DA FUNÇÃO PARAR LEITURA ---

    // --- FUNÇÃO DE AVANÇO PARA O PRÓXIMO VERSÍCULO ---
    async function lerProximoVersiculo() {
        if (indiceVersiculoAtual >= dadosVersiculosAtuais.length || estadoLeitura !== 'tocando') {
            console.log("Leitura concluída ou interrompida.");
            pararLeitura(true);
            return;
        }

        const versiculoElementoAtual = versiculosDoCapituloElementos[indiceVersiculoAtual];
        const dadosVersiculo = dadosVersiculosAtuais[indiceVersiculoAtual];
        if (!dadosVersiculo || typeof dadosVersiculo.texto === 'undefined') {
            console.error(`Erro: Dados inválidos para o índice ${indiceVersiculoAtual}. Parando.`);
            pararLeitura(true);
            return;
        }
        const textoParaLer = dadosVersiculo.texto;

        if(versiculoElementoAtual) {
            // Remove destaque de todos os versículos antes de destacar o atual
            document.querySelectorAll('.lendo-agora').forEach(el => el.classList.remove('lendo-agora'));
            versiculoElementoAtual.classList.add('lendo-agora');
            console.log(`Highlight adicionado ao índice ${indiceVersiculoAtual}`);
            versiculoElementoAtual.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        try {
            const onAudioEndCallback = () => {
                console.log(`onAudioEndCallback: Áudio do índice ${indiceVersiculoAtual} terminou. Estado atual: ${estadoLeitura}`);
                if (estadoLeitura === 'tocando') {
                    indiceVersiculoAtual++;
                    lerProximoVersiculo();
                } else {
                    console.log(`onAudioEndCallback: Estado mudou para ${estadoLeitura}. Interrompendo ciclo.`);
                    if (versiculoElementoAtual) versiculoElementoAtual.classList.remove('lendo-agora');
                }
            };

            console.log(`Iniciando tocarAudio (Google TTS) para índice ${indiceVersiculoAtual}`);
            await tocarAudio(textoParaLer, onAudioEndCallback);

        } catch (error) {
            console.error(`Erro capturado no ciclo lerProximoVersiculo (índice ${indiceVersiculoAtual}):`, error);
            if (versiculoElementoAtual) versiculoElementoAtual.classList.remove('lendo-agora');
        }
    }
    // --- FIM DA FUNÇÃO DE AVANÇO ---

    // --- FUNÇÃO TOCAR ÁUDIO (COM ABORTCONTROLLER) ---
    async function tocarAudio(texto, onEndedCallback) {
        if (!SUA_CHAVE_API_GOOGLE || SUA_CHAVE_API_GOOGLE === 'COLE_AQUI_A_CHAVE_API_DO_GOOGLE') {
            alert('Por favor, configure sua chave de API do Google Cloud no arquivo script.js');
            estadoLeitura = 'parado';
            const btn = document.getElementById('play-pause-btn'); if(btn) btn.innerHTML = '▶️';
            throw new Error("API Keys not set");
        }

        const googleTtsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${SUA_CHAVE_API_GOOGLE}`;

        if(timeoutLimpezaAudio) {
            console.log("Cancelando timeout de limpeza anterior ao iniciar novo áudio (tocarAudio).");
            clearTimeout(timeoutLimpezaAudio);
            timeoutLimpezaAudio = null;
        }
        if (audioAtual && audioAtual.ended) {
            console.warn("audioAtual existia mas já tinha terminado, limpando referência.");
            audioAtual = null;
        }

        try {
            console.log("Chamando API do Google Cloud...");
            abortController = new AbortController(); // Cria novo controller para este fetch
            const response = await fetch(googleTtsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: { text: texto },
                    voice: { languageCode: 'pt-BR', name: NOME_DA_VOZ },
                    audioConfig: {
                        audioEncoding: 'MP3',
                        speakingRate: taxaDeFala
                    }
                }),
                signal: abortController.signal // Adiciona signal para abortar
            });
            abortController = null; // Limpa após sucesso

            console.log(`Resposta da API: ${response.status}`);

            // Verifica se o estado ainda é 'tocando' APÓS o fetch
            if (estadoLeitura !== 'tocando') {
                console.warn("Estado mudou durante fetch TTS. Ignorando resposta.");
                return; // Sai cedo, não cria áudio
            }

            if (response.ok) {
                const data = await response.json();
                if (!data.audioContent) {
                    throw new Error("Resposta da API inválida: sem conteúdo de áudio.");
                }
                const audioBlob = b64toBlob(data.audioContent, 'audio/mp3');
                const audioUrl = URL.createObjectURL(audioBlob);
                console.log(`audioUrl criado: ${audioUrl}`);

                if (audioAtual) {
                    console.error("ERRO DE LÓGICA INESPERADO: audioAtual não era null ao criar novo áudio!");
                    pararLeitura(false);
                }
                audioAtual = new Audio(audioUrl);
                console.log("Novo audioAtual criado:", audioAtual);

                const handleEnded = () => {
                    console.log(`Evento 'ended' disparado para índice ${indiceVersiculoAtual}. Estado no momento do disparo: ${estadoLeitura}`);
                    const esteAudio = audioAtual;

                    if (audioAtual === esteAudio) {
                        audioAtual = null;
                        console.log("Referência global audioAtual anulada em ended.");
                    } else {
                        console.warn("handleEnded: audioAtual global mudou antes do fim, não anulando.");
                    }

                    if(esteAudio){
                        esteAudio.removeEventListener('ended', handleEnded);
                        esteAudio.removeEventListener('error', handleError);
                        try { if (audioUrl) URL.revokeObjectURL(audioUrl); console.log("URL revogado em ended:", audioUrl);} catch(e) { console.warn("Erro ao revogar URL em ended (ignorado):", e);}
                    }

                    if (estadoLeitura === 'tocando' && onEndedCallback) {
                        onEndedCallback();
                    } else {
                        console.log(`Callback 'onEndedCallback' NÃO chamado pois estadoLeitura é ${estadoLeitura}`);
                    }
                };
                audioAtual.addEventListener('ended', handleEnded);

                const handleError = (e) => {
                    console.error("Audio playback error event:", e);
                    if (!audioAtual) {
                        console.warn("handleError: audioAtual já é null, ignorando limpeza.");
                        return;
                    }
                    const esteAudio = audioAtual;
                    if (audioAtual === esteAudio) {
                        audioAtual = null;
                    }

                    if(esteAudio){
                        esteAudio.removeEventListener('ended', handleEnded);
                        esteAudio.removeEventListener('error', handleError);
                        try { if (audioUrl) URL.revokeObjectURL(audioUrl); console.log("URL revogado em error:", audioUrl); } catch(e) { console.warn("Erro ao revogar URL em error (ignorado):", e);}
                    }
                    alert("Erro ao tocar o áudio. Verifique a conexão ou tente novamente.");
                    pararLeitura(true);
                };
                audioAtual.addEventListener('error', handleError);

                console.log("Iniciando playback do audioAtual");
                try {
                    await audioAtual.play();
                    console.log("Playback iniciado com sucesso.");
                } catch (playError) {
                    console.error("Erro ao tentar dar play no áudio:", playError);
                    alert("Não foi possível iniciar o áudio automaticamente. Clique em Play novamente ou verifique as permissões do navegador.");
                    handleError(playError);
                    throw playError;
                }
            } else {
                const errorText = await response.text();
                console.error('Erro na API do Google Cloud:', errorText);
                alert('Erro na API do Google Cloud: ' + errorText);
                pararLeitura(true);
                throw new Error("API Error");
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Fetch TTS abortado intencionalmente.');
            } else {
                console.error('Erro geral na função tocarAudio:', error);
            }
            abortController = null; // Limpa em caso de erro
            if (estadoLeitura !== 'parado') {
                pararLeitura(true);
            }
        }
    }
    // --- FIM DA FUNÇÃO TOCAR ÁUDIO ---

    // Função auxiliar para converter Base64 para Blob
    function b64toBlob(b64Data, contentType='') {
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
    }

    // --- CONEXÃO DO SLIDER DE VELOCIDADE ---
    const taxaFalaInput = document.getElementById('taxa-fala');
    const taxaFalaLabel = document.querySelector('.velocidade-control label');

    if (taxaFalaInput && taxaFalaLabel) {
        taxaFalaLabel.textContent = `Velocidade (${parseFloat(taxaFalaInput.value).toFixed(2)}x)`;
    }

    taxaFalaInput.addEventListener('input', (event) => {
        taxaDeFala = parseFloat(event.target.value);
        if (taxaFalaLabel) {
            taxaFalaLabel.textContent = `Velocidade (${taxaDeFala.toFixed(2)}x)`;
        }
        console.log(`Velocidade de fala ajustada para: ${taxaDeFala}x`);

        if (estadoLeitura === 'tocando' || estadoLeitura === 'pausado') {
            const indiceDeRetomada = indiceVersiculoAtual;
            pararLeitura(false);
            indiceVersiculoAtual = indiceDeRetomada;

            estadoLeitura = 'tocando';
            const btn = document.getElementById('play-pause-btn');
            if(btn) btn.innerHTML = '⏸️';
            setTimeout(() => {
                if (estadoLeitura === 'tocando') {
                    console.log("Reiniciando leitura após ajuste de velocidade.");
                    lerProximoVersiculo();
                } else {
                    console.log("Estado mudou após ajuste de velocidade, não reiniciando.");
                }
            }, 300);
        }
    });
    // --- FIM DA CONEXÃO DO SLIDER ---

    // Inicia o processo carregando a lista de livros
    popularLivros();
});