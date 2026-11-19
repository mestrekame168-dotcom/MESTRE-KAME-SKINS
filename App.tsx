import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform,
  SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import { isBackendConfigured, supabase } from './src/supabase';

const GOLD = '#E7B83F';
const BG = '#101010';
const PANEL = '#1C1C1C';
const MUTED = '#A7A7A7';
const CATEGORIES = ['Todas', 'Scania', 'Volvo', 'Mercedes', 'Caminhões', 'Baús', 'Carretas'];

type Post = {
  id: string; user_id: string; username: string; title: string; description: string;
  category: string; image_url: string; created_at: string; likes_count?: number;
  liked?: boolean;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'feed'|'publish'|'profile'>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [category, setCategory] = useState('Todas');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authMode, setAuthMode] = useState<'login'|'signup'>('signup');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [postCategory, setPostCategory] = useState('Scania');
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string,string>>({});
  const [comments, setComments] = useState<Record<string,any[]>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isBackendConfigured) { setLoading(false); return; }
    supabase.auth.getSession().then(({data}) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadPosts();
  }, [session]);

  const visiblePosts = useMemo(
    () => category === 'Todas' ? posts : posts.filter(p => p.category === category),
    [posts, category]
  );

  async function loadPosts() {
    const { data, error } = await supabase.from('posts')
      .select('id,user_id,title,description,category,image_url,created_at,profiles(username),likes(user_id)')
      .order('created_at', { ascending: false });
    if (error) { Alert.alert('Não foi possível carregar', error.message); return; }
    const mapped = (data ?? []).map((p:any) => ({
      ...p,
      username: p.profiles?.username || 'Motorista',
      likes_count: p.likes?.length ?? 0,
      liked: p.likes?.some((l:any) => l.user_id === session?.user.id) ?? false
    }));
    setPosts(mapped);
  }

  async function authenticate() {
    if (!email.trim() || password.length < 6) {
      Alert.alert('Confira os dados', 'Informe seu e-mail e uma senha com pelo menos 6 caracteres.');
      return;
    }
    setBusy(true);
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { username: username.trim() || email.split('@')[0] } }
        });
        if (error) throw error;
        Alert.alert('Cadastro enviado', 'Se a confirmação de e-mail estiver ativada no Supabase, confirme seu e-mail antes de entrar.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (e:any) { Alert.alert('Erro', e.message || 'Não foi possível entrar.'); }
    finally { setBusy(false); }
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso às fotos para escolher a imagem da skin.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.88
    });
    if (!result.canceled) setImage(result.assets[0]);
  }

  async function publish() {
    if (!session) return;
    if (!image || !title.trim()) {
      Alert.alert('Falta informação', 'Escolha uma imagem e informe o nome da skin.');
      return;
    }
    setBusy(true);
    try {
      const ext = (image.fileName?.split('.').pop() || 'jpg').toLowerCase();
      const path = `${session.user.id}/${Date.now()}.${ext}`;
      const base64 = await FileSystem.readAsStringAsync(image.uri, { encoding: 'base64' });
      const bytes = decode(base64);
      const { error: uploadError } = await supabase.storage.from('skins').upload(path, bytes, {
        contentType: image.mimeType || 'image/jpeg', upsert: false
      });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from('skins').getPublicUrl(path);
      const { error } = await supabase.from('posts').insert({
        user_id: session.user.id,
        title: title.trim(),
        description: description.trim(),
        category: postCategory,
        image_url: publicData.publicUrl
      });
      if (error) throw error;
      setTitle(''); setDescription(''); setImage(null); setTab('feed');
      Alert.alert('Publicado!', 'Sua skin já está na galeria.');
      await loadPosts();
    } catch (e:any) { Alert.alert('Erro ao publicar', e.message || 'Tente novamente.'); }
    finally { setBusy(false); }
  }

  async function toggleLike(post: Post) {
    if (!session) return;
    const previous = posts;
    setPosts(current => current.map(p => p.id === post.id
      ? {...p, liked: !p.liked, likes_count: Math.max(0,(p.likes_count || 0) + (p.liked ? -1 : 1))}
      : p));
    const result = post.liked
      ? await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', session.user.id)
      : await supabase.from('likes').insert({post_id: post.id, user_id: session.user.id});
    if (result.error) { setPosts(previous); Alert.alert('Erro', result.error.message); }
  }

  async function loadComments(postId: string) {
    const { data, error } = await supabase.from('comments')
      .select('id,body,created_at,profiles(username)').eq('post_id', postId)
      .order('created_at', {ascending: true});
    if (error) { Alert.alert('Comentários', error.message); return; }
    setComments(c => ({...c, [postId]: (data ?? []).map((x:any) => ({...x, username:x.profiles?.username || 'Motorista'}))}));
  }

  async function addComment(postId: string) {
    const body = (commentDraft[postId] || '').trim();
    if (!body || !session) return;
    const { error } = await supabase.from('comments').insert({post_id:postId,user_id:session.user.id,body});
    if (error) { Alert.alert('Erro', error.message); return; }
    setCommentDraft(c => ({...c,[postId]:''}));
    await loadComments(postId);
  }

  async function downloadSkin(url: string) {
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) { Alert.alert('Permissão necessária', 'Autorize salvar imagens na galeria.'); return; }
      const local = `${FileSystem.cacheDirectory}skin-${Date.now()}.jpg`;
      const result = await FileSystem.downloadAsync(url, local);
      await MediaLibrary.saveToLibraryAsync(result.uri);
      Alert.alert('Skin salva', 'A imagem foi salva na galeria do celular.');
    } catch (e:any) { Alert.alert('Erro ao baixar', e.message || 'Não foi possível salvar.'); }
  }

  async function signOut() { await supabase.auth.signOut(); setPosts([]); }

  if (loading) return <View style={styles.center}><ActivityIndicator color={GOLD} size="large"/></View>;

  if (!isBackendConfigured) {
    return <SafeAreaView style={styles.safe}>
      <ExpoStatusBar style="light"/>
      <View style={styles.setup}>
        <Text style={styles.brand}>MESTRE KAME <Text style={{color:GOLD}}>SKINS</Text></Text>
        <Text style={styles.heading}>Seu aplicativo está pronto para configurar.</Text>
        <Text style={styles.body}>Para ativar publicações públicas entre celulares, crie um projeto gratuito no Supabase e coloque a URL e a chave pública no arquivo .env. O passo a passo está no README.md.</Text>
        <Text style={styles.step}>1. Abra o projeto no computador com Node.js.</Text>
        <Text style={styles.step}>2. Copie .env.example para .env e preencha as duas chaves.</Text>
        <Text style={styles.step}>3. Execute o SQL de supabase/schema.sql no painel SQL do Supabase.</Text>
        <Text style={styles.step}>4. Crie o bucket público chamado skins.</Text>
        <Text style={styles.step}>5. Execute npm install e npx expo start.</Text>
        <Text style={styles.note}>Sem essas chaves, o app abre nesta tela de configuração; não é uma rede social publicada ainda.</Text>
      </View>
    </SafeAreaView>;
  }

  if (!session) return <SafeAreaView style={styles.safe}>
    <ExpoStatusBar style="light"/>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.auth}>
      <Text style={styles.brand}>MESTRE KAME <Text style={{color:GOLD}}>SKINS</Text></Text>
      <Text style={styles.heading}>A comunidade dos criadores de skins</Text>
      <TextInput style={styles.input} placeholder="Seu nome de jogador" placeholderTextColor={MUTED} value={username} onChangeText={setUsername}/>
      <TextInput style={styles.input} placeholder="E-mail" placeholderTextColor={MUTED} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail}/>
      <TextInput style={styles.input} placeholder="Senha (mínimo 6 caracteres)" placeholderTextColor={MUTED} secureTextEntry value={password} onChangeText={setPassword}/>
      <TouchableOpacity style={styles.goldButton} onPress={authenticate} disabled={busy}>
        {busy ? <ActivityIndicator color="#111"/> : <Text style={styles.goldButtonText}>{authMode === 'signup' ? 'CRIAR CONTA' : 'ENTRAR'}</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}>
        <Text style={styles.link}>{authMode === 'signup' ? 'Já tenho conta — entrar' : 'Não tenho conta — criar cadastro'}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  </SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ExpoStatusBar style="light"/>
    <View style={styles.header}>
      <View><Text style={styles.brand}>MESTRE KAME <Text style={{color:GOLD}}>SKINS</Text></Text><Text style={styles.tagline}>SUA SKIN. SUA MARCA.</Text></View>
      <TouchableOpacity onPress={loadPosts}><Text style={styles.refresh}>↻</Text></TouchableOpacity>
    </View>

    {tab === 'feed' && <View style={{flex:1}}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories} contentContainerStyle={{paddingHorizontal:16}}>
        {CATEGORIES.map(c => <TouchableOpacity key={c} onPress={() => setCategory(c)} style={[styles.chip, category===c && styles.chipActive]}><Text style={[styles.chipText,category===c && styles.chipTextActive]}>{c}</Text></TouchableOpacity>)}
      </ScrollView>
      <FlatList
        data={visiblePosts} keyExtractor={p => p.id}
        contentContainerStyle={{padding:16,paddingBottom:100}}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyIcon}>🚛</Text><Text style={styles.heading}>Ainda não há skins</Text><Text style={styles.body}>Seja o primeiro a publicar uma criação!</Text></View>}
        renderItem={({item}) => <View style={styles.post}>
          <View style={styles.postHeader}><View style={styles.avatar}><Text style={styles.avatarText}>{item.username.slice(0,1).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={styles.user}>{item.username}</Text><Text style={styles.postMeta}>{item.category} • {new Date(item.created_at).toLocaleDateString('pt-BR')}</Text></View></View>
          <Image source={{uri:item.image_url}} style={styles.postImage} resizeMode="cover"/>
          <View style={styles.postContent}><Text style={styles.postTitle}>{item.title}</Text>{!!item.description && <Text style={styles.body}>{item.description}</Text>}
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => toggleLike(item)} style={styles.action}><Text style={{color:item.liked?'#FF667A':'#F3F3F3',fontSize:17}}>{item.liked?'♥':'♡'} {item.likes_count || 0}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => loadComments(item.id)} style={styles.action}><Text style={styles.actionText}>💬 Comentários</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => downloadSkin(item.image_url)} style={styles.action}><Text style={styles.actionText}>↓ Baixar</Text></TouchableOpacity>
            </View>
            {comments[item.id] && <View style={styles.comments}>
              {comments[item.id].map((c:any) => <Text key={c.id} style={styles.comment}><Text style={{color:GOLD,fontWeight:'bold'}}>{c.username}: </Text>{c.body}</Text>)}
              <View style={styles.commentRow}><TextInput style={[styles.input,{flex:1,marginBottom:0}]} placeholder="Escreva um comentário..." placeholderTextColor={MUTED} value={commentDraft[item.id]||''} onChangeText={v=>setCommentDraft(d=>({...d,[item.id]:v}))}/><TouchableOpacity style={styles.send} onPress={() => addComment(item.id)}><Text style={{color:'#111',fontWeight:'bold'}}>Enviar</Text></TouchableOpacity></View>
            </View>}
          </View>
        </View>}
      />
    </View>}

    {tab === 'publish' && <ScrollView contentContainerStyle={styles.publish}>
      <Text style={styles.heading}>Publicar uma skin</Text>
      <Text style={styles.body}>Compartilhe sua criação com todos os jogadores.</Text>
      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        {image ? <Image source={{uri:image.uri}} style={styles.preview}/> : <><Text style={{fontSize:40}}>＋</Text><Text style={styles.actionText}>Escolher imagem da skin</Text></>}
      </TouchableOpacity>
      <TextInput style={styles.input} placeholder="Nome da skin *" placeholderTextColor={MUTED} value={title} onChangeText={setTitle}/>
      <TextInput style={[styles.input,{height:90,textAlignVertical:'top'}]} placeholder="Descrição (opcional)" placeholderTextColor={MUTED} multiline value={description} onChangeText={setDescription}/>
      <Text style={styles.label}>Categoria</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>{CATEGORIES.slice(1).map(c=><TouchableOpacity key={c} onPress={()=>setPostCategory(c)} style={[styles.chip,postCategory===c&&styles.chipActive]}><Text style={[styles.chipText,postCategory===c&&styles.chipTextActive]}>{c}</Text></TouchableOpacity>)}</ScrollView>
      <TouchableOpacity style={styles.goldButton} onPress={publish} disabled={busy}>{busy?<ActivityIndicator color="#111"/>:<Text style={styles.goldButtonText}>PUBLICAR PARA TODOS</Text>}</TouchableOpacity>
    </ScrollView>}

    {tab === 'profile' && <View style={styles.profile}>
      <View style={styles.bigAvatar}><Text style={styles.avatarText}>{(username || session.user.email || 'M').slice(0,1).toUpperCase()}</Text></View>
      <Text style={styles.heading}>{username || 'Meu perfil'}</Text>
      <Text style={styles.body}>{session.user.email}</Text>
      <Text style={styles.stat}>{posts.filter(p=>p.user_id===session.user.id).length} skins publicadas</Text>
      <TouchableOpacity style={[styles.goldButton,{marginTop:24}]} onPress={signOut}><Text style={styles.goldButtonText}>SAIR DA CONTA</Text></TouchableOpacity>
    </View>}

    <View style={styles.bottom}>
      <TouchableOpacity onPress={()=>setTab('feed')} style={styles.nav}><Text style={[styles.navIcon,tab==='feed'&&styles.navSelected]}>⌂</Text><Text style={[styles.navText,tab==='feed'&&styles.navSelected]}>Galeria</Text></TouchableOpacity>
      <TouchableOpacity onPress={()=>setTab('publish')} style={styles.nav}><Text style={[styles.navIcon,tab==='publish'&&styles.navSelected]}>＋</Text><Text style={[styles.navText,tab==='publish'&&styles.navSelected]}>Publicar</Text></TouchableOpacity>
      <TouchableOpacity onPress={()=>setTab('profile')} style={styles.nav}><Text style={[styles.navIcon,tab==='profile'&&styles.navSelected]}>◉</Text><Text style={[styles.navText,tab==='profile'&&styles.navSelected]}>Perfil</Text></TouchableOpacity>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:BG}, center:{flex:1,backgroundColor:BG,alignItems:'center',justifyContent:'center'},
  setup:{flex:1,justifyContent:'center',padding:24}, auth:{flex:1,justifyContent:'center',padding:24},
  brand:{fontSize:25,fontWeight:'900',letterSpacing:1.2,color:'#FFF'}, tagline:{color:GOLD,fontSize:10,letterSpacing:2,marginTop:3,marginBottom:24},
  heading:{fontSize:22,fontWeight:'800',color:'#FFF',marginTop:14,marginBottom:8}, body:{color:MUTED,fontSize:14,lineHeight:21},
  step:{color:'#EEE',fontSize:14,marginTop:13,lineHeight:20}, note:{color:GOLD,fontSize:12,marginTop:22,lineHeight:18},
  input:{backgroundColor:PANEL,borderWidth:1,borderColor:'#333',borderRadius:12,padding:14,color:'#FFF',marginTop:12,fontSize:15},
  goldButton:{backgroundColor:GOLD,borderRadius:12,padding:16,alignItems:'center',justifyContent:'center',marginTop:18,minHeight:52},
  goldButtonText:{color:'#17130A',fontWeight:'900',letterSpacing:0.7},link:{color:GOLD,textAlign:'center',marginTop:20,fontWeight:'700'},
  header:{paddingHorizontal:18,paddingTop:12,paddingBottom:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  refresh:{color:GOLD,fontSize:28}, categories:{maxHeight:48,flexGrow:0}, chip:{borderWidth:1,borderColor:'#3A3A3A',paddingHorizontal:14,paddingVertical:9,borderRadius:22,marginRight:8,backgroundColor:PANEL},
  chipActive:{backgroundColor:GOLD,borderColor:GOLD},chipText:{color:'#DDD',fontWeight:'600',fontSize:12},chipTextActive:{color:'#17130A'},
  empty:{alignItems:'center',paddingTop:90},emptyIcon:{fontSize:54},post:{backgroundColor:PANEL,borderRadius:16,overflow:'hidden',marginBottom:18,borderWidth:1,borderColor:'#292929'},
  postHeader:{flexDirection:'row',alignItems:'center',padding:13},avatar:{width:38,height:38,borderRadius:19,backgroundColor:'#4B3A13',alignItems:'center',justifyContent:'center',marginRight:10},
  avatarText:{color:GOLD,fontWeight:'900',fontSize:17},user:{color:'#FFF',fontWeight:'800'},postMeta:{color:MUTED,fontSize:11,marginTop:3},
  postImage:{width:'100%',height:235,backgroundColor:'#292929'},postContent:{padding:14},postTitle:{color:'#FFF',fontWeight:'900',fontSize:18,marginBottom:6},
  actions:{flexDirection:'row',justifyContent:'space-between',marginTop:14,flexWrap:'wrap'},action:{paddingVertical:6,paddingRight:10},actionText:{color:'#EEE',fontSize:12,fontWeight:'700'},
  comments:{borderTopWidth:1,borderTopColor:'#383838',marginTop:12,paddingTop:10},comment:{color:'#DDD',fontSize:13,marginBottom:8},commentRow:{flexDirection:'row',alignItems:'center',gap:8,marginTop:6},
  send:{backgroundColor:GOLD,padding:13,borderRadius:10},publish:{padding:18,paddingBottom:100},imagePicker:{height:210,borderRadius:16,borderWidth:1,borderColor:'#6B5725',borderStyle:'dashed',backgroundColor:PANEL,alignItems:'center',justifyContent:'center',marginTop:20,overflow:'hidden'},
  preview:{width:'100%',height:'100%'},label:{color:'#FFF',fontWeight:'800',marginTop:18,marginBottom:8},profile:{flex:1,alignItems:'center',justifyContent:'center',padding:24},
  bigAvatar:{width:92,height:92,borderRadius:46,backgroundColor:'#4B3A13',alignItems:'center',justifyContent:'center',marginBottom:8},stat:{color:GOLD,fontWeight:'800',fontSize:16,marginTop:18},
  bottom:{height:68,backgroundColor:'#181818',borderTopWidth:1,borderTopColor:'#333',flexDirection:'row',justifyContent:'space-around',alignItems:'center'},
  nav:{alignItems:'center',minWidth:70},navIcon:{fontSize:23,color:'#888'},navText:{fontSize:11,color:'#888',marginTop:2},navSelected:{color:GOLD,fontWeight:'900'}
});
