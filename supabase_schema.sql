-- ==============================================================================
-- CAMAÇARI INOVA — ESQUEMA COMPLETO DE BANCO DE DADOS (SUPABASE / POSTGRESQL)
-- ==============================================================================
-- Descrição: Tabelas, relacionamentos, enumerações, triggers, RLS (Row Level Security),
--            índices de desempenho e dados iniciais (DEMO) para a plataforma Camaçari INOVA.
-- Como executar: Abra o Dashboard do Supabase -> SQL Editor -> Cole este código -> Run.
-- ==============================================================================

-- 1. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABELA DE PERFIS DE USUÁRIOS (public.profiles)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telefone VARCHAR(30) DEFAULT '',
    cargo VARCHAR(100) DEFAULT '',
    is_admin BOOLEAN NOT NULL DEFAULT false,
    preferencias JSONB NOT NULL DEFAULT '{"tema": "dark", "side_collapsed": false}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.profiles IS 'Perfil público e dados cadastrais dos usuários sincronizados com auth.users.';
COMMENT ON COLUMN public.profiles.is_admin IS 'Define se o usuário tem privilégios de moderação no sistema.';

-- ==============================================================================
-- 3. TABELA DE ORGANIZAÇÕES (public.organizacoes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.organizacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tipo_cadastro VARCHAR(20) NOT NULL DEFAULT 'organizacao' CHECK (tipo_cadastro IN ('organizacao', 'pessoa')),
    nome VARCHAR(160) NOT NULL,
    razao_social VARCHAR(180) DEFAULT '',
    cnpj VARCHAR(20) DEFAULT '',
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('empresa', 'startup', 'ensino', 'governo', 'associacao', 'ong', 'fomento', 'hub', 'outro')),
    cep VARCHAR(10) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    rua VARCHAR(150) NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    areas TEXT[] NOT NULL DEFAULT '{}',
    descricao TEXT NOT NULL,
    competencias TEXT DEFAULT '',
    recursos TEXT DEFAULT '',
    demandas TEXT DEFAULT '',
    site VARCHAR(255) DEFAULT '',
    email VARCHAR(255) DEFAULT '',
    autoriza BOOLEAN NOT NULL DEFAULT false,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    status VARCHAR(20) NOT NULL DEFAULT 'analise' CHECK (status IN ('analise', 'aprovada', 'rejeitada', 'privada')),
    motivo_rejeicao TEXT DEFAULT '',
    is_demo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.organizacoes IS 'Instituições, empresas e iniciativas cadastradas no ecossistema Camaçari INOVA.';
COMMENT ON COLUMN public.organizacoes.areas IS 'Cidades e regiões de atuação na RMS (Camaçari, Salvador, Lauro de Freitas, etc).';
COMMENT ON COLUMN public.organizacoes.recursos IS 'Itens em “Eu tenho”: recursos disponíveis para colaboração mútua (usados no matchmaking).';
COMMENT ON COLUMN public.organizacoes.demandas IS 'Itens em “Eu procuro”: problemas e necessidades de parcerias (usados no matchmaking).';
COMMENT ON COLUMN public.organizacoes.status IS 'Status da moderação: analise, aprovada, rejeitada ou privada.';

-- ==============================================================================
-- 4. TABELA DE DIAGNÓSTICOS DE INOVAÇÃO (public.diagnosticos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.diagnosticos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    pontuacao_total INTEGER NOT NULL CHECK (pontuacao_total >= 0 AND pontuacao_total <= 100),
    nivel VARCHAR(50) NOT NULL CHECK (nivel IN ('Explorador', 'Experimentador', 'Estruturado', 'Referência')),
    ponto_atencao VARCHAR(100) DEFAULT '',
    dimensoes JSONB NOT NULL DEFAULT '{}'::jsonb,
    respostas JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.diagnosticos IS 'Histórico de diagnósticos de maturidade de inovação das organizações/usuários.';

-- ==============================================================================
-- 5. TABELA DE CONEXÕES / MATCHMAKING (public.conexoes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.conexoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organizacao_alvo_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceita', 'recusada')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_conexao_solicitacao UNIQUE (solicitante_id, organizacao_alvo_id)
);

COMMENT ON TABLE public.conexoes IS 'Solicitações de conexão e contato entre usuários e organizações parceiras.';

-- ==============================================================================
-- 6. TABELA DE MENSAGENS DO CHAT (public.mensagens)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conexao_id UUID NOT NULL REFERENCES public.conexoes(id) ON DELETE CASCADE,
    remetente_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    conteudo TEXT NOT NULL CHECK (char_length(trim(conteudo)) > 0 AND char_length(conteudo) <= 2000),
    lida BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.mensagens IS 'Mensagens de texto trocadas no chat entre participantes de conexões ativas.';

-- ==============================================================================
-- 7. FUNÇÕES E GATILHOS (TRIGGERS) DE SISTEMA
-- ==============================================================================

-- 7.1. Atualização automática do campo `updated_at`
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_organizacoes_updated_at ON public.organizacoes;
CREATE TRIGGER trg_organizacoes_updated_at
BEFORE UPDATE ON public.organizacoes
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_conexoes_updated_at ON public.conexoes;
CREATE TRIGGER trg_conexoes_updated_at
BEFORE UPDATE ON public.conexoes
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7.2. Identificação de Administrador/Moderador
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
        false
    ) OR (COALESCE(auth.jwt() ->> 'email', '') = 'admin@camacariinova.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 7.3. Criação automática de Perfil ao registrar novo usuário no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_nome TEXT;
    v_is_admin BOOLEAN;
BEGIN
    v_nome := COALESCE(
        NEW.raw_user_meta_data->>'nome',
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1)
    );
    v_is_admin := (NEW.email = 'admin@camacariinova.com');

    INSERT INTO public.profiles (id, nome, email, is_admin)
    VALUES (NEW.id, v_nome, NEW.email, v_is_admin)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 8. POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conexoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 8.1. Políticas para `profiles`
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Perfis visíveis para autenticados" ON public.profiles;
CREATE POLICY "Perfis visíveis para autenticados"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Usuários editam próprio perfil" ON public.profiles;
CREATE POLICY "Usuários editam próprio perfil"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 8.2. Políticas para `organizacoes`
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Organizações públicas visíveis para todos" ON public.organizacoes;
CREATE POLICY "Organizações públicas visíveis para todos"
ON public.organizacoes FOR SELECT
TO public
USING (
    (status = 'aprovada' AND autoriza = true)
    OR is_demo = true
    OR (auth.role() = 'authenticated' AND (owner_id = auth.uid() OR public.is_admin()))
);

DROP POLICY IF EXISTS "Usuários autenticados criam organizações" ON public.organizacoes;
CREATE POLICY "Usuários autenticados criam organizações"
ON public.organizacoes FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Proprietários e moderadores editam organizações" ON public.organizacoes;
CREATE POLICY "Proprietários e moderadores editam organizações"
ON public.organizacoes FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() OR public.is_admin())
WITH CHECK (owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Proprietários e moderadores excluem organizações" ON public.organizacoes;
CREATE POLICY "Proprietários e moderadores excluem organizações"
ON public.organizacoes FOR DELETE
TO authenticated
USING (owner_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 8.3. Políticas para `diagnosticos`
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Usuários veem seus próprios diagnósticos" ON public.diagnosticos;
CREATE POLICY "Usuários veem seus próprios diagnósticos"
ON public.diagnosticos FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Usuários criam seus diagnósticos" ON public.diagnosticos;
CREATE POLICY "Usuários criam seus diagnósticos"
ON public.diagnosticos FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Usuários excluem seus diagnósticos" ON public.diagnosticos;
CREATE POLICY "Usuários excluem seus diagnósticos"
ON public.diagnosticos FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 8.4. Políticas para `conexoes`
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participantes e moderadores veem conexões" ON public.conexoes;
CREATE POLICY "Participantes e moderadores veem conexões"
ON public.conexoes FOR SELECT
TO authenticated
USING (
    solicitante_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.organizacoes o
        WHERE o.id = public.conexoes.organizacao_alvo_id
        AND o.owner_id = auth.uid()
    )
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Usuários solicitam conexões" ON public.conexoes;
CREATE POLICY "Usuários solicitam conexões"
ON public.conexoes FOR INSERT
TO authenticated
WITH CHECK (solicitante_id = auth.uid());

DROP POLICY IF EXISTS "Dono da organização responde à conexão" ON public.conexoes;
CREATE POLICY "Dono da organização responde à conexão"
ON public.conexoes FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organizacoes o
        WHERE o.id = public.conexoes.organizacao_alvo_id
        AND o.owner_id = auth.uid()
    )
    OR public.is_admin()
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organizacoes o
        WHERE o.id = public.conexoes.organizacao_alvo_id
        AND o.owner_id = auth.uid()
    )
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Participantes podem cancelar ou excluir conexões" ON public.conexoes;
CREATE POLICY "Participantes podem cancelar ou excluir conexões"
ON public.conexoes FOR DELETE
TO authenticated
USING (
    solicitante_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.organizacoes o
        WHERE o.id = public.conexoes.organizacao_alvo_id
        AND o.owner_id = auth.uid()
    )
    OR public.is_admin()
);

-- ------------------------------------------------------------------------------
-- 8.5. Políticas para `mensagens`
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participantes da conexão aceita veem mensagens" ON public.mensagens;
CREATE POLICY "Participantes da conexão aceita veem mensagens"
ON public.mensagens FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conexoes c
        WHERE c.id = public.mensagens.conexao_id
        AND c.status = 'aceita'
        AND (
            c.solicitante_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.organizacoes o
                WHERE o.id = c.organizacao_alvo_id
                AND o.owner_id = auth.uid()
            )
        )
    )
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Participantes enviam mensagens em conexões aceitas" ON public.mensagens;
CREATE POLICY "Participantes enviam mensagens em conexões aceitas"
ON public.mensagens FOR INSERT
TO authenticated
WITH CHECK (
    remetente_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.conexoes c
        WHERE c.id = public.mensagens.conexao_id
        AND c.status = 'aceita'
        AND (
            c.solicitante_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.organizacoes o
                WHERE o.id = c.organizacao_alvo_id
                AND o.owner_id = auth.uid()
            )
        )
    )
);

-- ==============================================================================
-- 9. ÍNDICES DE ALTO DESEMPENHO (PERFORMANCE & SEARCH)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_orgs_status_autoriza ON public.organizacoes (status, autoriza);
CREATE INDEX IF NOT EXISTS idx_orgs_tipo ON public.organizacoes (tipo);
CREATE INDEX IF NOT EXISTS idx_orgs_cidade ON public.organizacoes (cidade);
CREATE INDEX IF NOT EXISTS idx_orgs_owner ON public.organizacoes (owner_id);
CREATE INDEX IF NOT EXISTS idx_orgs_geo ON public.organizacoes (lat, lng);
CREATE INDEX IF NOT EXISTS idx_diag_user ON public.diagnosticos (user_id);
CREATE INDEX IF NOT EXISTS idx_conexoes_solicitante ON public.conexoes (solicitante_id);
CREATE INDEX IF NOT EXISTS idx_conexoes_org_alvo ON public.conexoes (organizacao_alvo_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_conexao_created ON public.mensagens (conexao_id, created_at ASC);

-- ==============================================================================
-- 10. SUPABASE REALTIME (CHAT E ATUALIZAÇÃO DO MAPA)
-- ==============================================================================
-- Adiciona tabelas na publicação de Realtime de forma segura e idempotente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'mensagens'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'conexoes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conexoes;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'organizacoes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.organizacoes;
    END IF;
END $$;

-- ==============================================================================
-- 11. DADOS INICIAIS DE DEMONSTRAÇÃO (SEED DEMO DATA)
-- ==============================================================================
INSERT INTO public.organizacoes (
    id,
    nome,
    tipo,
    cidade,
    rua,
    numero,
    bairro,
    cep,
    lat,
    lng,
    competencias,
    descricao,
    recursos,
    demandas,
    areas,
    autoriza,
    status,
    is_demo
) VALUES
(
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Polo Petroquímico Inovação',
    'empresa',
    'Camaçari',
    'Complexo Industrial de Camaçari',
    'S/N',
    'Polo Industrial',
    '42816-000',
    -12.6996,
    -38.3263,
    'Química verde, Automação, ESG',
    'Indústria e centro de inovação com foco em sustentabilidade e eficiência energética.',
    'Laboratórios industriais, plantas piloto, mentoria de processos',
    'Soluções de reciclagem avançada, inteligência artificial preditiva',
    ARRAY['Camaçari', 'Dias d''Ávila', 'Simões Filho'],
    true,
    'aprovada',
    true
),
(
    '00000000-0000-0000-0000-000000000002'::uuid,
    'Campus Tecnológico Integrado',
    'ensino',
    'Camaçari',
    'Av. Jorge Amado',
    '1000',
    'Jardim Limoeiro',
    '42800-000',
    -12.6900,
    -38.3100,
    'Pesquisa aplicada, IA, Capacitação técnica',
    'Instituição de ensino e laboratórios avançados para projetos conjuntos com a indústria.',
    'Bolsistas de graduação e pós-graduação, laboratórios de prototipagem, auditórios',
    'Desafios reais da indústria local para aplicar em projetos de extensão',
    ARRAY['Camaçari', 'Salvador', 'Lauro de Freitas'],
    true,
    'aprovada',
    true
),
(
    '00000000-0000-0000-0000-000000000003'::uuid,
    'Secretaria de Desenvolvimento Econômico',
    'governo',
    'Camaçari',
    'Rua Francisco Drumond',
    'S/N',
    'Centro Administrativo',
    '42800-900',
    -12.6980,
    -38.3380,
    'Políticas públicas, Fomento, Atração de investimentos',
    'Poder público fomentando a inovação, simplificação regulatória e parcerias empresariais na RMS.',
    'Incentivos fiscais, articulação governamental, espaços públicos para eventos',
    'Mapeamento de gargalos logísticos e projetos de qualificação profissional',
    ARRAY['Camaçari'],
    true,
    'aprovada',
    true
),
(
    '00000000-0000-0000-0000-000000000004'::uuid,
    'Hub Camaçari Tech',
    'hub',
    'Camaçari',
    'Rua das Palmeiras',
    '250',
    'Centro',
    '42800-120',
    -12.7050,
    -38.3190,
    'Aceleração, Mentoria, Espaço Maker',
    'Ambiente de inovação aberta, coworking e aceleração de soluções digitais e industriais.',
    'Coworking, impressoras 3D, rede de investidores-anjo e mentores',
    'Startups industriais e B2B buscando validação e tração',
    ARRAY['Camaçari', 'Salvador', 'Candeias', 'Simões Filho'],
    true,
    'aprovada',
    true
),
(
    '00000000-0000-0000-0000-000000000005'::uuid,
    'BioInova Bahia',
    'startup',
    'Dias d''Ávila',
    'Rodovia BA-093',
    'Km 5',
    'Zona Industrial',
    '42850-000',
    -12.6153,
    -38.3000,
    'Biotecnologia, Resíduos, Novos materiais',
    'Startup desenvolvendo biomateriais a partir de subprodutos da cadeia produtiva local.',
    'Tecnologia proprietária de extração verde e protótipos de bioplásticos',
    'Investimento Seed e testes de aplicação industrial em larga escala',
    ARRAY['Dias d''Ávila', 'Camaçari', 'Mata de São João'],
    true,
    'aprovada',
    true
)
ON CONFLICT (id) DO NOTHING;
