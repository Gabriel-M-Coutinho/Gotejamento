import stringSimilarity from "string-similarity";
import inquirer from "inquirer";

export class CotejamentoTurboService {
    private static llmClient: any = null;
    
    // Inicializar cliente LLM
    static async inicializarLLM() {
        // Descomente conforme sua LLM:
        
        // OLLAMA (localhost:11434)
        // const { Ollama } = require('ollama');
        // this.llmClient = new Ollama({ host: 'http://localhost:11434' });
        
        // LM STUDIO (localhost:1234)
        // const OpenAI = require('openai');
        // this.llmClient = new OpenAI({
        //     baseURL: 'http://localhost:1234/v1',
        //     apiKey: 'lm-studio'
        // });
        
        console.log("✓ LLM inicializada");
    }

    // Cache de validações para evitar reprocessar
    private static cacheValidacoes = new Map<string, any>();

    // Validar em BATCH (múltiplas comparações em uma chamada)
    static async ValidarBatchComLLM(pares: Array<{
        id: string;
        descCliente: string;
        descGalileu: string;
    }>): Promise<Map<string, { match: boolean; confianca: number; razao: string }>> {
        
        // Montar prompt para múltiplas validações
        const paresTexto = pares.map((p, i) => 
            `PAR ${i + 1} (ID: ${p.id}):
Cliente: "${p.descCliente}"
Galileu: "${p.descGalileu}"`
        ).join('\n\n');

        const prompt = `Você é um especialista em comparação de produtos. Analise se cada par se refere ao MESMO produto.

${paresTexto}

Responda APENAS com um JSON array:
[
  {"id": "par_id", "match": true/false, "confianca": 0.0-1.0, "razao": "breve explicação"},
  ...
]

Considere sinônimos, abreviações, mesma categoria. Ignore formatação.`;

        try {
            // Para Ollama
            // const response = await this.llmClient.chat({
            //     model: 'llama3.2:3b',
            //     messages: [{ role: 'user', content: prompt }],
            //     format: 'json'
            // });
            // const resultados = JSON.parse(response.message.content);

            // Para LM Studio
            // const response = await this.llmClient.chat.completions.create({
            //     model: "local-model",
            //     messages: [{ role: "user", content: prompt }],
            //     temperature: 0.1
            // });
            // const resultados = JSON.parse(response.choices[0].message.content);

            // MOCK para teste (REMOVA em produção)
            const resultados = pares.map(p => ({
                id: p.id,
                match: Math.random() > 0.5,
                confianca: 0.7 + Math.random() * 0.25,
                razao: "Mock validation"
            }));

            // Converter para Map
            const mapaResultados = new Map();
            resultados.forEach((r: any) => {
                mapaResultados.set(r.id, {
                    match: r.match,
                    confianca: r.confianca,
                    razao: r.razao
                });
            });

            return mapaResultados;

        } catch (error) {
            console.error("Erro ao consultar LLM:", error);
            return new Map();
        }
    }

    // Normalização rápida
    private static normalizar(texto: string): string {
        return texto
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    // Similaridade ultra-rápida (Jaccard em tokens)
    private static similaridadeRapida(s1: string, s2: string): number {
        const tokens1 = new Set(this.normalizar(s1).split(" ").filter(t => t.length > 2));
        const tokens2 = new Set(this.normalizar(s2).split(" ").filter(t => t.length > 2));
        
        const intersecao = [...tokens1].filter(x => tokens2.has(x)).length;
        const uniao = new Set([...tokens1, ...tokens2]).size;
        
        return uniao > 0 ? intersecao / uniao : 0;
    }

    // Indexação para busca rápida
    private static criarIndice(data: any[], colunaDesc: string): Map<string, Set<number>> {
        const indice = new Map<string, Set<number>>();
        
        data.forEach((row, idx) => {
            const tokens = this.normalizar(String(row[colunaDesc])).split(" ");
            tokens.forEach(token => {
                if (token.length > 2) {
                    if (!indice.has(token)) indice.set(token, new Set());
                    indice.get(token)!.add(idx);
                }
            });
        });
        
        return indice;
    }

    // Buscar candidatos usando índice
    private static buscarCandidatosIndexados(
        descGalileu: string,
        indice: Map<string, Set<number>>,
        dataCliente: any[],
        blacklist: Set<string>,
        colunaIdCliente: string,
        maxCandidatos: number = 10
    ): Array<{ row: any; score: number }> {
        const tokensGalileu = this.normalizar(descGalileu).split(" ").filter(t => t.length > 2);
        const candidatosScores = new Map<number, number>();
        
        // Para cada token do Galileu, buscar itens do cliente que têm esse token
        tokensGalileu.forEach(token => {
            const indices = indice.get(token);
            if (indices) {
                indices.forEach(idx => {
                    const clienteId = String(dataCliente[idx][colunaIdCliente]);
                    if (!blacklist.has(clienteId)) {
                        candidatosScores.set(idx, (candidatosScores.get(idx) || 0) + 1);
                    }
                });
            }
        });
        
        // Ordenar por score (quantidade de tokens em comum)
        const topCandidatos = Array.from(candidatosScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxCandidatos)
            .map(([idx, score]) => ({
                row: dataCliente[idx],
                score: score / tokensGalileu.length
            }));
        
        return topCandidatos;
    }

    // Cotejamento TURBO
    static async CotejarTurbo(
        dataCliente: any[], 
        dataGalileu: any[],
        colunaCliente: string,
        colunaGalileu: string,
        colunaStatus: string,
        colunaIdCliente: string,
        colunaIdGalileu: string,
        opcoes: {
            limiarPreFiltragem?: number;
            limiarLLMConfianca?: number;
            batchSizeLLM?: number;
            maxCandidatosPorItem?: number;
            usarLLM?: boolean;
        } = {}
    ) {
        const {
            limiarPreFiltragem = 0.25,
            limiarLLMConfianca = 0.75,
            batchSizeLLM = 20, // LLM valida 20 pares por vez
            maxCandidatosPorItem = 3,
            usarLLM = true
        } = opcoes;

        console.log(`\n🚀 MODO TURBO ATIVADO`);
        console.log(`   📊 Cliente: ${dataCliente.length} itens`);
        console.log(`   📊 Galileu: ${dataGalileu.length} itens`);
        console.log(`   🔍 Criando índice invertido...`);
        
        const inicio = Date.now();
        
        // Criar índice para busca ultra-rápida
        const indiceCliente = this.criarIndice(dataCliente, colunaCliente);
        console.log(`   ✓ Índice criado em ${Date.now() - inicio}ms`);

        if (usarLLM) {
            await this.inicializarLLM();
        }

        const response: any[] = [];
        const blacklistCliente = new Set<string>();
        
        // Buffer para validação em batch com LLM
        let bufferLLM: Array<{
            id: string;
            galileuRow: any;
            clienteRow: any;
            scorePreliminar: number;
        }> = [];

        let processados = 0;
        const inicioProcessamento = Date.now();

        console.log(`\n   ⚡ Processando...`);

        for (const galileuRow of dataGalileu) {
            const galileuDesc = String(galileuRow[colunaGalileu]);
            const galileuId = String(galileuRow[colunaIdGalileu]);
            const status = String(galileuRow[colunaStatus]);

            // Busca rápida usando índice
            const candidatos = this.buscarCandidatosIndexados(
                galileuDesc,
                indiceCliente,
                dataCliente,
                blacklistCliente,
                colunaIdCliente,
                maxCandidatosPorItem
            );

            if (candidatos.length === 0) {
                processados++;
                continue;
            }

            // Calcular similaridade refinada nos top candidatos
            const candidatosComScore = candidatos.map(c => {
                const clienteDesc = String(c.row[colunaCliente]);
                const score = this.similaridadeRapida(clienteDesc, galileuDesc);
                return { ...c, scoreRefinado: score };
            }).filter(c => c.scoreRefinado >= limiarPreFiltragem);

            if (candidatosComScore.length === 0) {
                processados++;
                continue;
            }

            // Pegar o melhor candidato
            const melhorCandidato = candidatosComScore.sort((a, b) => b.scoreRefinado - a.scoreRefinado)[0];

            if (usarLLM) {
                // Adicionar ao buffer para validação LLM em batch
                const parId = `${galileuId}_${String(melhorCandidato.row[colunaIdCliente])}`;
                bufferLLM.push({
                    id: parId,
                    galileuRow,
                    clienteRow: melhorCandidato.row,
                    scorePreliminar: melhorCandidato.scoreRefinado
                });

                // Quando o buffer encher, validar em batch
                if (bufferLLM.length >= batchSizeLLM) {
                    const paresParaValidar = bufferLLM.map(item => ({
                        id: item.id,
                        descCliente: String(item.clienteRow[colunaCliente]),
                        descGalileu: String(item.galileuRow[colunaGalileu])
                    }));

                    const resultadosLLM = await this.ValidarBatchComLLM(paresParaValidar);

                    // Processar resultados
                    bufferLLM.forEach(item => {
                        const resultado = resultadosLLM.get(item.id);
                        if (resultado && resultado.match && resultado.confianca >= limiarLLMConfianca) {
                            const clienteId = String(item.clienteRow[colunaIdCliente]);
                            if (!blacklistCliente.has(clienteId)) {
                                response.push({
                                    cliente_id: clienteId,
                                    galileu_id: String(item.galileuRow[colunaIdGalileu]),
                                    cliente_descritivo: String(item.clienteRow[colunaCliente]),
                                    galileu_descritivo: String(item.galileuRow[colunaGalileu]),
                                    status: String(item.galileuRow[colunaStatus]),
                                    porcentagem_string: Math.round(item.scorePreliminar * 100),
                                    confianca_llm: Math.round(resultado.confianca * 100),
                                    razao_llm: resultado.razao
                                });
                                blacklistCliente.add(clienteId);
                            }
                        }
                    });

                    bufferLLM = [];
                }
            } else {
                // Sem LLM: aceitar direto se passou no limiar
                const clienteId = String(melhorCandidato.row[colunaIdCliente]);
                if (!blacklistCliente.has(clienteId)) {
                    response.push({
                        cliente_id: clienteId,
                        galileu_id: galileuId,
                        cliente_descritivo: String(melhorCandidato.row[colunaCliente]),
                        galileu_descritivo: galileuDesc,
                        status,
                        porcentagem_string: Math.round(melhorCandidato.scoreRefinado * 100)
                    });
                    blacklistCliente.add(clienteId);
                }
            }

            processados++;
            if (processados % 1000 === 0) {
                const tempoDecorrido = (Date.now() - inicioProcessamento) / 1000;
                const velocidade = processados / tempoDecorrido;
                const tempoRestante = (dataGalileu.length - processados) / velocidade;
                console.log(`   📈 ${processados}/${dataGalileu.length} | ${velocidade.toFixed(0)} itens/seg | ~${Math.ceil(tempoRestante)}s restantes`);
            }
        }

        // Processar buffer restante
        if (usarLLM && bufferLLM.length > 0) {
            const paresParaValidar = bufferLLM.map(item => ({
                id: item.id,
                descCliente: String(item.clienteRow[colunaCliente]),
                descGalileu: String(item.galileuRow[colunaGalileu])
            }));

            const resultadosLLM = await this.ValidarBatchComLLM(paresParaValidar);

            bufferLLM.forEach(item => {
                const resultado = resultadosLLM.get(item.id);
                if (resultado && resultado.match && resultado.confianca >= limiarLLMConfianca) {
                    const clienteId = String(item.clienteRow[colunaIdCliente]);
                    if (!blacklistCliente.has(clienteId)) {
                        response.push({
                            cliente_id: clienteId,
                            galileu_id: String(item.galileuRow[colunaIdGalileu]),
                            cliente_descritivo: String(item.clienteRow[colunaCliente]),
                            galileu_descritivo: String(item.galileuRow[colunaGalileu]),
                            status: String(item.galileuRow[colunaStatus]),
                            porcentagem_string: Math.round(item.scorePreliminar * 100),
                            confianca_llm: Math.round(resultado.confianca * 100),
                            razao_llm: resultado.razao
                        });
                        blacklistCliente.add(clienteId);
                    }
                }
            });
        }

        const tempoTotal = (Date.now() - inicio) / 1000;
        
        console.log(`\n   ✅ CONCLUÍDO EM ${tempoTotal.toFixed(1)}s`);
        console.log(`   📊 Matches encontrados: ${response.length}/${dataGalileu.length}`);
        console.log(`   ⚡ Velocidade: ${(dataGalileu.length / tempoTotal).toFixed(0)} itens/seg`);

        return response;
    }

    // Wrapper interativo
    static async CotejarInterativo(dataCliente: any[], dataGalileu: any[]) {
        if (dataCliente.length === 0 || dataGalileu.length === 0) {
            console.log("Uma das planilhas está vazia!");
            return [];
        }

        const colunasCliente = Object.keys(dataCliente[0]);
        const colunasGalileu = Object.keys(dataGalileu[0]);

        const config = await inquirer.prompt([
            { type: "list", name: "colunaCliente", message: "Coluna descrição (Cliente):", choices: colunasCliente },
            { type: "list", name: "colunaGalileu", message: "Coluna descrição (Galileu):", choices: colunasGalileu },
            { type: "list", name: "colunaStatus", message: "Coluna status (Galileu):", choices: colunasGalileu },
            { type: "list", name: "colunaIdCliente", message: "Coluna ID (Cliente):", choices: colunasCliente },
            { type: "list", name: "colunaIdGalileu", message: "Coluna ID (Galileu):", choices: colunasGalileu },
            { 
                type: "confirm", 
                name: "usarLLM", 
                message: "Usar LLM para validação final? (mais preciso, mais lento)", 
                default: true
            },
            { 
                type: "input", 
                name: "limiarLLM", 
                message: "Confiança mínima da LLM (0.70-0.90):", 
                default: "0.75",
                when: (answers) => answers.usarLLM,
                validate: (input) => {
                    const num = parseFloat(input);
                    return (!isNaN(num) && num >= 0 && num <= 1) || "Entre 0 e 1";
                }
            }
        ]);

        return this.CotejarTurbo(
            dataCliente,
            dataGalileu,
            config.colunaCliente,
            config.colunaGalileu,
            config.colunaStatus,
            config.colunaIdCliente,
            config.colunaIdGalileu,
            {
                limiarPreFiltragem: 0.25,
                limiarLLMConfianca: config.usarLLM ? parseFloat(config.limiarLLM) : 0.75,
                batchSizeLLM: 20,
                maxCandidatosPorItem: 3,
                usarLLM: config.usarLLM
            }
        );
    }
}