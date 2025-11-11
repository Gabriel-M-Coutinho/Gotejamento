import axios from "axios";

export class CorretorOrtograficoService {
  private static readonly API_URL = "https://api.languagetool.org/v2/check";
  private static readonly MAX_LENGTH = 400; 

  /**
   * Corrige texto usando a API do LanguageTool.
   */
  static async corrigirTexto(texto: string): Promise<string> {
    // pular textos muito grandes
    if (texto.length > 2000) {
      console.log("⏭️ Texto muito longo, pulando...");
      return texto;
    }

    // dividir em blocos
    const blocos = this.dividirTexto(texto, this.MAX_LENGTH);
    const resultados: string[] = [];

    for (const bloco of blocos) {
      try {
        const resposta = await axios.post(this.API_URL, null, {
          params: {
            text: bloco,
            language: "pt-BR",
          },
          timeout: 10000,
        });

        let textoCorrigido = bloco;

        // aplicar correções
        for (const match of resposta.data.matches) {
          if (match.replacements && match.replacements.length > 0) {
            const sugestao = match.replacements[0].value;
            textoCorrigido = textoCorrigido.replace(match.context.text, sugestao);
          }
        }

        resultados.push(textoCorrigido);
      } catch (e) {
        console.error("❌ Erro ao corrigir texto:", e);
        resultados.push(bloco);
      }

      // respeita rate limit (1 req/s)
      await new Promise((r) => setTimeout(r, 1000));
    }

    return resultados.join(" ");
  }

  /**
   * Divide um texto longo em blocos menores sem cortar palavras
   */
  private static dividirTexto(texto: string, limite: number): string[] {
    const blocos: string[] = [];
    let atual = "";

    for (const palavra of texto.split(" ")) {
      if ((atual + " " + palavra).length > limite) {
        blocos.push(atual.trim());
        atual = palavra;
      } else {
        atual += " " + palavra;
      }
    }

    if (atual.trim().length > 0) blocos.push(atual.trim());
    return blocos;
  }
}
