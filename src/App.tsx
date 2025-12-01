import { useEffect, useState, Component, type ReactNode, type ErrorInfo } from 'react'
import { Tldraw, useEditor } from 'tldraw'
import { createClient } from '@supabase/supabase-js'
import 'tldraw/tldraw.css'
import './App.css' 

// =============================================================================
// 1. 配置与初始化
// =============================================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const TLDRAW_LICENSE_KEY = import.meta.env.VITE_TLDRAW_LICENSE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// =============================================================================
// 2. 防崩卫士 (Error Boundary)
// =============================================================================
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error("网页崩溃详情:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', background: '#fff', height: '100vh', zIndex: 99999999, position: 'relative' }}>
          <h2>💥 网页崩溃了！</h2>
          <p>错误信息：{this.state.error?.toString()}</p>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ padding: '10px 20px', marginTop: 10, cursor: 'pointer' }}>
            尝试清空缓存并刷新
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// =============================================================================
// 3. 顶部导航栏
// =============================================================================
function TopNavigationBar() {
    return (
        <div style={{
            height: '50px', background: '#ffffff', borderBottom: '1px solid #e0e0e0',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', 
            padding: '0 20px', zIndex: 3000, boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            position: 'absolute', top: 0, left: 0, right: 0
        }}>
            <span style={{ marginRight: '15px', color: '#666', fontWeight: 'bold', fontSize: '14px' }}>
                Lab Chen 在线协作平台
            </span>
            <img 
                src="https://hhofyvimltossvlgfriv.supabase.co/storage/v1/object/public/bio-icons/1111.png"
                alt="Logo"
                style={{ height: '36px', borderRadius: '4px' }} 
            />
        </div>
    )
}

// =============================================================================
// 4. 登录界面
// =============================================================================
function LoginScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const handleLogin = async (e: any) => {
        e.preventDefault(); setLoading(true); setErrorMsg('')
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        setLoading(false)
        if (error) setErrorMsg('登录失败：账号或密码错误')
        else onLoginSuccess()
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#f5f5f7', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: '320px', textAlign: 'center' }}>
                <h2 style={{marginTop: 0, color: '#333'}}>Lab Chen 资源库</h2>
                <form onSubmit={handleLogin} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                    <input type="email" placeholder="邮箱" required value={email} onChange={e => setEmail(e.target.value)} style={{padding: '10px', border:'1px solid #ddd', borderRadius:'6px'}}/>
                    <input type="password" placeholder="密码" required value={password} onChange={e => setPassword(e.target.value)} style={{padding: '10px', border:'1px solid #ddd', borderRadius:'6px'}}/>
                    {errorMsg && <div style={{color: 'red', fontSize: '12px'}}>{errorMsg}</div>}
                    <button type="submit" disabled={loading} style={{padding: '10px', background: '#2684ff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight:'bold'}}>{loading ? '登录中...' : '进入实验室'}</button>
                </form>
            </div>
        </div>
    )
}

// =============================================================================
// 5. 画布拖拽监听
// =============================================================================
function CanvasDropZone() {
    const editor: any = useEditor();
    useEffect(() => {
        const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.dataTransfer!.dropEffect = 'copy'; };
        const handleDrop = async (e: DragEvent) => {
            const bioUrl = e.dataTransfer?.getData('bio-render-url');
            if (!bioUrl) return; 
            e.preventDefault(); e.stopImmediatePropagation();
            try {
                const point = editor.screenToPage({ x: e.clientX, y: e.clientY });
                try {
                    const response = await fetch(bioUrl);
                    const blob = await response.blob();
                    const file = new File([blob], "asset.svg", { type: blob.type });
                    editor.putExternalContent({ type: 'files', files: [file], point: point, ignoreParent: false });
                } catch (fetchErr) {
                    editor.createShape({ type: 'image', x: point.x - 50, y: point.y - 50, props: { w: 100, h: 100, url: bioUrl } });
                }
            } catch (error) { console.error("拖拽失败:", error); }
        };
        window.addEventListener('dragover', handleDragOver, true);
        window.addEventListener('drop', handleDrop, true);
        return () => { window.removeEventListener('dragover', handleDragOver, true); window.removeEventListener('drop', handleDrop, true); }
    }, [editor]);
    return null;
}

// =============================================================================
// 6. 侧边栏 (已修复防消失和防崩溃)
// =============================================================================
function CustomSidebar({ currentUser, onLogout }: { currentUser: any, onLogout: () => void }) {
    const editor: any = useEditor()
    const [isOpen, setIsOpen] = useState(true) 
    const [activeTab, setActiveTab] = useState('资源库') 
    
    // 数据状态
    const [categories, setCategories] = useState<any>({});
    const [currentCategory, setCurrentCategory] = useState('实验仪器')
    const [searchTerm, setSearchTerm] = useState('') 
    const [projects, setProjects] = useState<any[]>([])
    
    // AI 与 上传
    const [prompt, setPrompt] = useState('')
    const [aiStyle, setAiStyle] = useState('Flat') 
    const [isAiLoading, setIsAiLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [targetCategory, setTargetCategory] = useState('实验仪器')

    // 🟢 安全加载：处理空数据防止崩溃
    const fetchAssets = async () => {
        try {
            const { data, error } = await supabase.from('assets').select('*');
            
            // 🛠️ 修复点：在这里使用 error 变量，报错就会消失
            if (error) {
                console.error("数据库读取错误:", error);
                throw error; // 或者直接 return
            }

            if (data) {
                const newCats: any = {};
                // 处理空数据
                if (data.length === 0) newCats['默认'] = [];
                else {
                    data.forEach((item: any) => {
                        const cat = item.category || '未分类';
                        if (!newCats[cat]) newCats[cat] = [];
                        newCats[cat].push(item);
                    });
                }
                setCategories(newCats);
                // 确保 currentCategory 有效
                const keys = Object.keys(newCats);
                if (keys.length > 0 && !newCats[currentCategory]) {
                    setCurrentCategory(keys[0]);
                    setTargetCategory(keys[0]);
                }
            }
        } catch (e) { console.error("加载失败", e); }
    }

    const fetchProjects = async () => {
        const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
        if (data) setProjects(data);
    }

    useEffect(() => {
        fetchAssets();
        fetchProjects();
    }, []);

    const handleUpload = async (file: File) => {
        setIsUploading(true);
        try {
            const ext = file.name.split('.').pop();
            const path = `${Date.now()}.${ext}`;
            await supabase.storage.from('bio-icons').upload(path, file);
            const { data: { publicUrl } } = supabase.storage.from('bio-icons').getPublicUrl(path);
            
            await supabase.from('assets').insert({ 
                name: file.name.split('.')[0], 
                url: publicUrl, 
                category: targetCategory,
                user_id: currentUser.id 
            });
            alert('上传成功'); 
            fetchAssets();
        } catch (e: any) { alert(e.message); } 
        finally { setIsUploading(false); }
    }
    
    const handleAIGenerate = async () => {
       if (!prompt || !GEMINI_API_KEY) return alert("请输入描述或配置Key");
       setIsAiLoading(true);
       try {
           const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;
           const systemPrompt = `Create an SVG code for: "${prompt}" in ${aiStyle} style. Return ONLY raw <svg> code.`;
           const response = await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] }) });
           const data = await response.json();
           let svgCode = data.candidates[0].content.parts[0].text.replace(/```xml|```svg|```/g, '').trim();
           const blob = new Blob([svgCode], { type: 'image/svg+xml' });
           
           const { w, h } = editor.getViewportScreenBounds()
           const center = editor.screenToPage({ x: w/2, y: h/2 })
           const file = new File([blob], "ai.svg", { type: 'image/svg+xml' });
           editor.putExternalContent({ type: 'files', files: [file], point: center });
           setPrompt(''); 
       } catch (error: any) { alert("生成失败: " + error.message); } finally { setIsAiLoading(false); }
   }

    const handleSaveProject = async () => {
        const name = window.prompt('请输入项目名称', '未命名实验图');
        if (!name) return;
        const snapshot = editor.store.getSnapshot();
        const { error } = await supabase.from('projects').insert({ name: name, data: snapshot, user_id: currentUser.id });
        if (error) alert('保存失败: ' + error.message);
        else { alert('✅ 保存成功'); fetchProjects(); }
    }

    const handleLoadProject = (projectData: any) => {
        if (confirm('加载云端项目覆盖当前画布？')) editor.store.loadSnapshot(projectData);
    }
    
    const handleDeleteProject = async (id: number) => {
        if (!confirm('确定删除？')) return;
        await supabase.from('projects').delete().eq('id', id);
        fetchProjects();
    }

    // 🟢 关键：安全获取列表，防止 5-6 秒后崩溃
    const currentAssets = (categories && currentCategory && categories[currentCategory]) ? categories[currentCategory] : [];

    return (
        <>
            {!isOpen && <div className="sidebar-toggle" onClick={() => setIsOpen(true)}>➡️</div>}
            
            <div className={`sidebar-container ${!isOpen ? 'collapsed' : ''}`}>
                <div className="sidebar-content">
                    <div className="header-row">
                        <div style={{flex: 1}}><h3 style={{margin:0}}>工具箱</h3></div>
                        <button onClick={onLogout} style={{fontSize: 10, padding: '2px 5px'}}>退出</button>
                        <button onClick={() => setIsOpen(false)} style={{cursor:'pointer'}}>⬅️</button>
                    </div>
                    
                    <div style={{display:'flex', gap:10, borderBottom:'1px solid #eee', paddingBottom:5, marginTop: 10}}>
                        <span onClick={() => setActiveTab('资源库')} style={{fontWeight:'bold', color: activeTab==='资源库'?'#2684ff':'#999', cursor:'pointer'}}>📂 素材库</span>
                        <span onClick={() => setActiveTab('项目')} style={{fontWeight:'bold', color: activeTab==='项目'?'#2684ff':'#999', cursor:'pointer'}}>💾 项目</span>
                    </div>

                    {activeTab === '资源库' && (
                        <>
                             <div style={{background:'#f0f7ff', padding:10, borderRadius:8, marginTop: 10}}>
                                <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="AI 生成图片..." className="search-input" />
                                <div style={{display:'flex', gap:5, marginTop:5}}>
                                     {['Flat', '3D', 'Sketch'].map(s => (
                                         <span key={s} onClick={() => setAiStyle(s)} style={{fontSize:10, padding:'2px 5px', background: aiStyle===s?'#2684ff':'#ddd', color: aiStyle===s?'white':'#333', borderRadius:4, cursor:'pointer'}}>{s}</span>
                                     ))}
                                </div>
                                <button onClick={handleAIGenerate} disabled={isAiLoading} style={{marginTop:5, width:'100%'}}>{isAiLoading?'生成中...':'✨ AI绘图'}</button>
                            </div>

                            <input placeholder="🔍 搜索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="search-input" style={{marginTop: 10}} />
                            
                            <div style={{display:'flex', gap:5, overflowX:'auto', marginTop: 10, paddingBottom:5}}>
                                {Object.keys(categories).map(cat => (
                                    <span key={cat} onClick={() => { setCurrentCategory(cat); setTargetCategory(cat); }} 
                                          style={{fontSize:11, padding:'3px 8px', borderRadius:10, background: currentCategory===cat?'#333':'#eee', color: currentCategory===cat?'white':'#333', cursor:'pointer', whiteSpace:'nowrap'}}>
                                        {cat}
                                    </span>
                                ))}
                            </div>

                            <div className="assets-grid" style={{marginTop: 10, maxHeight: '300px', overflowY: 'auto'}}>
                                {currentAssets
                                    .filter((asset: any) => asset.name.includes(searchTerm))
                                    .map((asset: any) => (
                                    <div key={asset.id} className="asset-card" draggable onDragStart={e => e.dataTransfer.setData('bio-render-url', asset.url)}>
                                        <img src={asset.url} alt={asset.name} style={{width:'100%', height:'50px', objectFit:'contain'}} />
                                        <div className="asset-name" style={{fontSize:10, textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{asset.name}</div>
                                    </div>
                                ))}
                                {currentAssets.length === 0 && <div style={{fontSize:12, color:'#999', textAlign:'center', marginTop:20}}>暂无素材</div>}
                            </div>

                            <label style={{display:'block', textAlign:'center', marginTop:20, cursor:'pointer', color:'blue', fontSize:12}}>
                                {isUploading ? '上传中...' : '☁️ 上传到当前分类'}
                                <input type="file" style={{display:'none'}} onChange={e => e.target.files && handleUpload(e.target.files[0])} />
                            </label>
                        </>
                    )}

                    {activeTab === '项目' && (
                        <div style={{marginTop: 20}}>
                            <button onClick={handleSaveProject} style={{width:'100%', padding:8, background:'#28a745', color:'white', border:'none', borderRadius:4, cursor:'pointer'}}>💾 保存当前画布</button>
                            <div style={{marginTop:10, maxHeight: '300px', overflowY: 'auto'}}>
                                {projects.map(p => (
                                    <div key={p.id} style={{padding:'8px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <span onClick={() => handleLoadProject(p.data)} style={{cursor:'pointer', flex:1}}>{p.name}</span>
                                        <span onClick={() => handleDeleteProject(p.id)} style={{cursor:'pointer', color:'red', fontWeight:'bold', padding:'0 5px'}}>×</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

// =============================================================================
// 7. 主程序 App
// =============================================================================
function App() {
    const [session, setSession] = useState<any>(null)
    const [isStyleOpen, setIsStyleOpen] = useState(true) 

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => { setSession(session) })
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session) })
        return () => subscription.unsubscribe()
    }, [])

    if (!session) return <LoginScreen onLoginSuccess={() => {}} /> 

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
            
            {/* 1. 顶部导航栏 (z-index 3000) */}
            <TopNavigationBar />

            {/* 2. 画布区域 */}
            <div style={{ position: 'absolute', top: '50px', bottom: 0, left: 0, right: 0, backgroundColor: '#e5e5e5' }}>
                
                <button 
                    className={`style-panel-toggle ${isStyleOpen ? 'active' : ''}`}
                    onClick={() => setIsStyleOpen(!isStyleOpen)}
                    style={{ top: '10px' }}
                >
                    {isStyleOpen ? '🎨' : '◀'}
                </button>

                {/* 3. ErrorBoundary 保护画布 */}
                <ErrorBoundary>
                    <Tldraw licenseKey={TLDRAW_LICENSE_KEY}>
                        <CanvasDropZone />
                        <CustomSidebar currentUser={session.user} onLogout={() => supabase.auth.signOut()} />
                    </Tldraw> 
                </ErrorBoundary>
            </div>
        </div>
    )
}

export default App