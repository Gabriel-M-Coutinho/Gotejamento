import { ExcelService } from "./excel";
import stringSimilarity from 'string-similarity';
import inquirer from 'inquirer';

export class CotejamentoService {
    static ValidarString(string1: string, string2: string): number {
        const similarity = stringSimilarity.compareTwoStrings(
            string1.toLowerCase(), 
            string2.toLowerCase()
        );
        return similarity;
    }

    static async Cotejar(excelClientePath: string, excelGalileuPath: string) {
        try {
            const excelClient = ExcelService.ReadExcel(excelClientePath);
            const excelGalileu = ExcelService.ReadExcel(excelGalileuPath);

            if (excelClient.length === 0 || excelGalileu.length === 0) {
                console.log("Uma das planilhas está vazia!");
                return [];
            }

            const colunasCliente = Object.keys(excelClient[0]);
            const colunasGalileu = Object.keys(excelGalileu[0]);

            const colunaDescricao = await inquirer.prompt([
                { type: 'list', name: 'colunaCliente', message: 'Escolha a coluna de descricao da planilha do cliente:', choices: colunasCliente },
                { type: 'list', name: 'colunaGalileu', message: 'Escolha a coluna de descricao da planilha do Galileu:', choices: colunasGalileu },
                { type: 'list', name: 'colunaStatus', message: 'Escolha a coluna de status da planilha do Galileu:', choices: colunasGalileu },
                { type: 'list', name: 'colunaIdCliente', message: 'Escolha a coluna de ID da planilha do Cliente:', choices: colunasCliente },
                { type: 'list', name: 'colunaIdGalileu', message: 'Escolha a coluna de ID da planilha do Galileu:', choices: colunasGalileu }
            ]);

            const { colunaCliente, colunaGalileu, colunaStatus, colunaIdCliente, colunaIdGalileu } = colunaDescricao;

            const response: {
                cliente_id: string;
                galileu_id: string;
                cliente_descritivo: string;
                galileu_descritivo: string;
                status: string;
                porcentagem_match: number;
            }[] = [];

            // Blacklist apenas para IDs do cliente
            const blacklistCliente = new Set<string>();

            excelGalileu.forEach(galileuRow => {
                if (galileuRow[colunaStatus] === "I-Incluido") {
                    const galileuId = String(galileuRow[colunaIdGalileu]);
                    
                    let melhorMatch: any = null;
                    let maiorPorcentagem = 0;

                    excelClient.forEach(clienteRow => {
                        try {
                            const clienteId = String(clienteRow[colunaIdCliente]);
                            
                            // Pula se já está na blacklist
                            if (blacklistCliente.has(clienteId)) {
                                return;
                            }

                            const porcentagem = this.ValidarString(
                                String(clienteRow[colunaCliente]),
                                String(galileuRow[colunaGalileu])
                            );

           
                                if (porcentagem > maiorPorcentagem) {
                                    maiorPorcentagem = porcentagem;
                                    melhorMatch = {
                                        cliente_id: clienteId,
                                        galileu_id: galileuId,
                                        cliente_descritivo: String(clienteRow[colunaCliente]),
                                        galileu_descritivo: String(galileuRow[colunaGalileu]),
                                        status: String(galileuRow[colunaStatus]),
                                        porcentagem_match: Math.round(porcentagem * 100) / 100 // Arredonda para 2 casas decimais
                                    };
                                }
                            
                        } catch (innerError) {
                            console.error(`Erro ao cotejar linha do cliente ID ${clienteRow[colunaIdCliente]} com Galileu ID ${galileuRow[colunaIdGalileu]}:`, innerError);
                        }
                    });

                    // Se encontrou um match válido, adiciona à resposta e à blacklist
                    if (melhorMatch) {
                        response.push(melhorMatch);
                        blacklistCliente.add(melhorMatch.cliente_id);
                    }
                }
            });

            console.log(`\nTotal de matches encontrados: ${response.length}`);
            console.log(`IDs do Cliente na blacklist: ${blacklistCliente.size}`);

            return response;
        } catch (error) {
            console.error("Erro ao executar o cotejamento:", error);
            return [];
        }
    }
}