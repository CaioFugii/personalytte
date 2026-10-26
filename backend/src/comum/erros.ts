export type CodigoErro =
  | 'DADOS_INVALIDOS'
  | 'CREDENCIAIS_INVALIDAS'
  | 'SEM_PERMISSAO'
  | 'NAO_ENCONTRADO'
  | 'HORARIO_OCUPADO'
  | 'BLOQUEIO_AGENDA'
  | 'AULA_JA_INICIOU'
  | 'PLANO_INCOMPLETO'
  | 'ULTIMO_ADMINISTRADOR'
  | 'INTEGRANTE_COM_AGENDA'
  | 'ERRO_INTERNO';

export class ErroApi extends Error {
  readonly name = 'ErroApi';

  constructor(
    readonly status: number,
    readonly codigo: CodigoErro,
    readonly mensagem: string,
  ) {
    super(mensagem);
  }
}

export const MENSAGEM_OCUPADO = 'Esse horário cruza outra aula do mesmo aluno ou responsável.';
export const MENSAGEM_GRUPO_CHEIO = 'Esse horário já tem 4 alunos com este professor.';
export const MENSAGEM_BLOQUEIO = 'Já existe um evento nesse horário.';
export const MENSAGEM_EVENTO_COM_AULA = 'Já existe uma aula nesse horário.';
export const MENSAGEM_DATA = 'Não é possível agendar uma data anterior a hoje.';
export const MENSAGEM_JA_INICIOU = 'A aula já começou e o horário não pode ser alterado.';
export const MENSAGEM_PLANO = 'Informe os horários e o professor juntos, ou deixe os dois vazios.';
export const MENSAGEM_ULTIMO = 'O último administrador ativo não pode ser inativado.';
export const MENSAGEM_ULTIMO_FUNCAO = 'O último administrador ativo não pode deixar de ser administrador.';
export const MENSAGEM_AGENDA = 'Este integrante ainda é responsável por um plano semanal ou por uma aula futura.';
export const MENSAGEM_SEM_PERMISSAO = 'Sem permissão para esta ação.';
export const MENSAGEM_NAO_ENCONTRADO = 'Registro não encontrado.';
export const MENSAGEM_CREDENCIAIS = 'E-mail ou senha inválidos.';
export const MENSAGEM_SESSAO = 'Sessão inválida.';

export function dadosInvalidos(mensagem: string): ErroApi {
  return new ErroApi(400, 'DADOS_INVALIDOS', mensagem);
}

export function naoEncontrado(mensagem = MENSAGEM_NAO_ENCONTRADO): ErroApi {
  return new ErroApi(404, 'NAO_ENCONTRADO', mensagem);
}

export function codigoPg(erro: unknown): string | undefined {
  let atual: unknown = erro;
  for (let i = 0; i < 6 && atual && typeof atual === 'object'; i += 1) {
    const codigo = (atual as { code?: unknown }).code;
    if (typeof codigo === 'string' && /^[0-9A-Z]{5}$/.test(codigo)) return codigo;
    atual = (atual as { cause?: unknown }).cause ?? (atual as { original?: unknown }).original;
  }
  return undefined;
}

export function traduzirErroBanco(erro: unknown): ErroApi | undefined {
  const codigo = codigoPg(erro);
  if (codigo === '23P01') return new ErroApi(409, 'HORARIO_OCUPADO', MENSAGEM_OCUPADO);
  if (codigo === '23505') return dadosInvalidos('E-mail já cadastrado.');
  return undefined;
}
