import { ExcelService } from "./excel";
import stringSimilarity from 'string-similarity';
import inquirer from 'inquirer';

export class CotejamentoService {

    static ValidarString(string1: string, string2: string): boolean {
        const similarity = stringSimilarity.compareTwoStrings(string1, string2);
        return similarity >= 0.75;
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
                { type: 'list', name: 'colunaCliente', message: 'Escolha a coluna da planilha do cliente:', choices: colunasCliente },
                { type: 'list', name: 'colunaGalileu', message: 'Escolha a coluna da planilha do Galileu:', choices: colunasGalileu },
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
            }[] = [];

            excelGalileu.forEach(galileuRow => {
                if (galileuRow[colunaStatus] === "I-INCLUIDO") {

                    excelClient.forEach(clienteRow => {
                        try {
                            if (this.ValidarString(
                                String(clienteRow[colunaCliente]),
                                String(galileuRow[colunaGalileu])
                            )) {
                                response.push({
                                    cliente_id: String(clienteRow[colunaIdCliente]),
                                    galileu_id: String(galileuRow[colunaIdGalileu]),
                                    cliente_descritivo: String(clienteRow[colunaCliente]),
                                    galileu_descritivo: String(galileuRow[colunaGalileu]),
                                    status: String(galileuRow[colunaStatus])
                                });
                            }
                        } catch (innerError) {
                            console.error(`Erro ao cotejar linha do cliente ID ${clienteRow[colunaIdCliente]} com Galileu ID ${galileuRow[colunaIdGalileu]}:`, innerError);
                        }
                    });

                }
            });

            return response;

        } catch (error) {
            console.error("Erro ao executar o cotejamento:", error);
            return [];
        }
    }
}
