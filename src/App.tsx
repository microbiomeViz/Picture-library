import { useEffect, useState } from 'react'
import { Tldraw, useEditor } from 'tldraw'
import { createClient } from '@supabase/supabase-js'
import 'tldraw/tldraw.css'
import './App.css' 

// =============================================================================
// ⚠️ 记得重新填入你的 Key ！
// =============================================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// -----------------------------------------------------------------------------
// 1. 登录组件
// -----------------------------------------------------------------------------
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
                <p style={{color: '#666', fontSize: '14px', marginBottom: '20px'}}>请登录以切换至您的工作区</p>
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

// -----------------------------------------------------------------------------
// 2. 拖拽逻辑
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// 3. 侧边栏
// -----------------------------------------------------------------------------
function CustomSidebar({ currentUser, onLogout }: { currentUser: any, onLogout: () => void }) {
	const editor: any = useEditor()
    
    const [isOpen, setIsOpen] = useState(true) 
    const [activeTab, setActiveTab] = useState('资源库') 
    
    // 资源库
    const [categories, setCategories] = useState<any>({});
    const [currentCategory, setCurrentCategory] = useState('实验仪器')
    const [searchTerm, setSearchTerm] = useState('') 
    
    // 项目
    const [projects, setProjects] = useState<any[]>([])
    
    // AI
    const [prompt, setPrompt] = useState('')
    const [aiStyle, setAiStyle] = useState('Flat') 
    const [isAiLoading, setIsAiLoading] = useState(false)

    // 上传
    const [isUploading, setIsUploading] = useState(false)
    const [targetCategory, setTargetCategory] = useState('实验仪器')

    // === 数据加载 ===
    const fetchAssets = async () => {
        const { data } = await supabase.from('assets').select('*');
        if (data) {
            const newCats: any = {};
            data.forEach((item: any) => {
                if (!newCats[item.category]) newCats[item.category] = [];
                newCats[item.category].push(item);
            });
            setCategories((prev: any) => {
                const merged = { ...newCats };
                Object.keys(prev).forEach(key => {
                    if (!merged[key] && prev[key].length === 0) merged[key] = [];
                });
                return merged;
            });
        }
    }

    const fetchProjects = async () => {
        const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
        if (data) setProjects(data);
    }

    useEffect(() => {
        if (activeTab === '资源库') fetchAssets();
        if (activeTab === '项目') fetchProjects();
        const sub1 = supabase.channel('assets_chan').on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, fetchAssets).subscribe();
        return () => { supabase.removeChannel(sub1); }
    }, [activeTab]);


    // === 操作逻辑 ===
    const handleDeleteAsset = async (assetId: number, assetUrl: string) => {
        if (!confirm('确定删除此素材吗？')) return;
        const path = assetUrl.split('/').pop();
        if (path) await supabase.storage.from('bio-icons').remove([path]);
        const { error } = await supabase.from('assets').delete().eq('id', assetId);
        if (error) alert("删除失败：只能删除自己上传的图片");
        else fetchAssets();
    }

    const handleRenameAsset = async (assetId: number, oldName: string) => {
        const newName = window.prompt("重命名素材:", oldName);
        if (!newName || newName === oldName) return;
        const { error } = await supabase.from('assets').update({ name: newName }).eq('id', assetId);
        if (error) alert("重命名失败: 只能修改自己上传的素材");
        else fetchAssets();
    }

    const handleRenameCategory = async (oldCategory: string) => {
        const newCategory = window.prompt(`将分组 "${oldCategory}" 重命名为:`, oldCategory);
        if (!newCategory || newCategory === oldCategory) return;
        if(!confirm(`⚠️ 注意：\n你只能重命名【你自己上传】的图片。\n确定要把你自己上传的 "${oldCategory}" 里的图片移动到 "${newCategory}" 吗？`)) return;

        const { data, error } = await supabase
            .from('assets')
            .update({ category: newCategory })
            .eq('category', oldCategory)
            .eq('user_id', currentUser.id)
            .select();

        if (error) {
            alert("❌ 数据库错误: " + error.message);
        } else if (!data || data.length === 0) {
            alert(`⚠️ 未能重命名：\n分组 "${oldCategory}" 下没有找到属于你上传的素材。`);
        } else {
            alert(`✅ 成功！已将你上传的 ${data.length} 个素材移至 "${newCategory}"`);
            await fetchAssets();
            setCurrentCategory(newCategory);
        }
    }

    const handleCreateCategory = () => {
        const name = window.prompt("请输入新分组名称：");
        if (!name) return;
        if (categories[name]) return alert("该分组已存在！");
        setCategories((prev: any) => ({ ...prev, [name]: [] }));
        setCurrentCategory(name);
        setTargetCategory(name);
        alert(`✅ 分组 "${name}" 已创建。请尽快上传图片以保存此分组。`);
    }

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
        } catch (e: any) { alert(e.message); } 
        finally { setIsUploading(false); }
    }

    const handleSaveProject = async () => {
        const name = window.prompt('请输入项目名称', '未命名实验图');
        if (!name) return;
        const snapshot = editor.store.getSnapshot();
        const { error } = await supabase.from('projects').insert({ name: name, data: snapshot, user_id: currentUser.id });
        if (error) alert('保存失败: ' + error.message);
        else { alert('项目已保存到云端'); fetchProjects(); }
    }

    const handleLoadProject = (projectData: any) => {
        if (confirm('加载云端项目会覆盖当前画布，确定吗？')) {
            editor.store.loadSnapshot(projectData);
        }
    }

    const handleDeleteProject = async (id: number) => {
        if (!confirm('确定删除此项目？')) return;
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) alert('删除失败'); else fetchProjects();
    }

    const handleAIGenerate = async () => {
        if (!prompt || !GEMINI_API_KEY) return alert("请输入描述或配置Key");
        setIsAiLoading(true);
        try {
            let stylePrompt = "";
            if (aiStyle === 'Flat') stylePrompt = "in flat vector art style, simple colors";
            if (aiStyle === '3D') stylePrompt = "in 3d render style, glossy, high quality";
            if (aiStyle === 'Sketch') stylePrompt = "in hand-drawn sketch style, black and white lines";
            
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;
            const systemPrompt = `You are a scientific illustrator. Create an SVG code for: "${prompt}" ${stylePrompt}. Return ONLY raw <svg> code. No markdown.`;
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

    useEffect(() => { setTargetCategory(currentCategory); }, [currentCategory]);

    return (
        <>
            {!isOpen && (
                <div className="sidebar-toggle" onClick={() => setIsOpen(true)} style={{left: 10}}>➡️</div>
            )}

            <div className={`sidebar-container ${!isOpen ? 'collapsed' : ''}`}>
                <div className="sidebar-content">
                    <div className="header-row" style={{alignItems:'center', gap: 10}}> {/* 修改了对齐方式 */}
        
        {/* 🟢 1. 这里是 Logo 区域 */}
        <img 
            src="https://hhofyvimltossvlgfriv.supabase.co/storage/v1/object/public/bio-icons/1111.png" 
            alt="Logo" 
            style={{
                width: '40px', 
                height: '40px', 
                objectFit: 'contain', 
                borderRadius: '4px' // 如果想要圆角可以保留这个
            }} 
        />

        {/* 🟢 2. 这里是标题和邮箱 */}
        <div style={{flex: 1}}> {/* 让它占据剩余空间 */}
            <h3 style={{margin:0, fontSize:'16px', lineHeight: '1.2'}}>Lab Chen</h3>
            <div style={{fontSize:'10px', color:'#999', maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                {currentUser.email}
            </div>
        </div>

        {/* 🟢 3. 这里是按钮组 */}
        <div style={{display:'flex', gap:5}}>
            <button onClick={onLogout} style={{fontSize:'10px', padding:'4px', background:'#ffebee', color:'#c62828', border:'none', borderRadius:4, cursor:'pointer'}} title="切换账号">
                🔁
            </button>
            <button onClick={() => setIsOpen(false)} style={{fontSize:'10px', padding:'4px', cursor:'pointer', border:'1px solid #ddd', background:'white', borderRadius:4}}>⬅️</button>
        </div>
    </div>
                    
                    

                    <div style={{display:'flex', gap:10, borderBottom:'1px solid #eee', paddingBottom:5}}>
                        <span onClick={() => setActiveTab('资源库')} style={{fontSize:13, fontWeight:'bold', color: activeTab==='资源库'?'#2684ff':'#999', cursor:'pointer'}}>📂 素材库</span>
                        <span onClick={() => setActiveTab('项目')} style={{fontSize:13, fontWeight:'bold', color: activeTab==='项目'?'#2684ff':'#999', cursor:'pointer'}}>💾 我的项目</span>
                    </div>

                    {activeTab === '资源库' && (
                        <>
                            <div style={{background:'#f0f7ff', padding:10, borderRadius:8}}>
                                <div style={{fontSize:11, fontWeight:'bold', color:'#2684ff', marginBottom:5}}>🤖 AI 绘图助手</div>
                                <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="描述素材..." className="search-input" />
                                <div className="style-chips">
                                    {['Flat', '3D', 'Sketch'].map(s => (
                                        <div key={s} onClick={() => setAiStyle(s)} className={`style-chip ${aiStyle===s?'active':''}`}>{s}</div>
                                    ))}
                                </div>
                                <button onClick={handleAIGenerate} disabled={isAiLoading} style={{width:'100%', marginTop:5, background:'#2684ff', color:'white', border:'none', padding:6, borderRadius:4, cursor:'pointer'}}>
                                    {isAiLoading ? '生成中...' : '生成'}
                                </button>
                            </div>

                            <input placeholder="🔍 搜索素材 (如: 烧杯)" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="search-input" />

                            <div style={{display:'flex', gap:5, overflowX:'auto', paddingBottom:5, alignItems:'center'}}>
                                {Object.keys(categories).map(cat => (
                                    <button 
                                        key={cat} 
                                        onClick={() => setCurrentCategory(cat)} 
                                        onDoubleClick={() => handleRenameCategory(cat)}
                                        title="双击可重命名"
                                        style={{fontSize:10, padding:'4px 8px', border:'1px solid #ddd', borderRadius:10, background: currentCategory===cat?'#333':'#fff', color:currentCategory===cat?'#fff':'#333', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0}}
                                    >
                                        {cat}
                                    </button>
                                ))}
                                <button onClick={handleCreateCategory} style={{fontSize:14, fontWeight:'bold', padding:'2px 8px', border:'1px dashed #999', borderRadius:10, background:'white', color:'#666', cursor:'pointer', flexShrink:0}} title="新建分组">+</button>
                            </div>
                            
                            <div style={{background:'#f9f9f9', padding:8, borderRadius:6, border:'1px solid #eee'}}>
                                <div style={{fontSize:11, marginBottom:5, color:'#666'}}>
                                    上传图片到: <b>{targetCategory}</b>
                                    <select 
                                        value={targetCategory} 
                                        onChange={e => setTargetCategory(e.target.value)} 
                                        style={{marginLeft:5, fontSize:10, maxWidth:100}}
                                    >
                                        {Object.keys(categories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                                <label style={{display:'block', textAlign:'center', padding:8, border:'1px dashed #ccc', borderRadius:6, cursor:'pointer', fontSize:12, color:'#2684ff', background:'white'}}>
                                    {isUploading ? '上传中...' : '☁️ 选择文件上传'}
                                    <input type="file" style={{display:'none'}} accept=".svg,.png,.jpg" onChange={e => e.target.files && handleUpload(e.target.files[0])} />
                                </label>
                            </div>

                            <div className="assets-grid">
                                {categories[currentCategory]
                                    ?.filter((asset: any) => asset.name.includes(searchTerm))
                                    .map((asset: any) => (
                                        <div key={asset.id} className="asset-card" draggable onDragStart={e => e.dataTransfer.setData('bio-render-url', asset.url)}
                                            onClick={async () => {
                                                const { w, h } = editor.getViewportScreenBounds()
                                                const center = editor.screenToPage({ x: w/2, y: h/2 })
                                                const res = await fetch(asset.url);
                                                const blob = await res.blob();
                                                const file = new File([blob], "asset.svg", { type: blob.type });
                                                editor.putExternalContent({ type: 'files', files: [file], point: center });
                                            }}
                                        >
                                            <img src={asset.url} alt={asset.name} />
                                            <div className="asset-name" onDoubleClick={(e) => { e.stopPropagation(); handleRenameAsset(asset.id, asset.name); }}>
                                                {asset.name}
                                            </div>
                                            {asset.user_id === currentUser.id && (
                                                <div className="delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteAsset(asset.id, asset.url); }}>×</div>
                                            )}
                                        </div>
                                ))}
                                {categories[currentCategory]?.length === 0 && (
                                    <div style={{gridColumn:'1 / -1', textAlign:'center', fontSize:11, color:'#999', padding:20}}>
                                        此分组为空，请点击上方按钮上传图片<br/>(空分组刷新后会消失)
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === '项目' && (
                        <div style={{display:'flex', flexDirection:'column', gap:10}}>
                            <button onClick={handleSaveProject} style={{background:'#28a745', color:'white', border:'none', padding:10, borderRadius:6, cursor:'pointer'}}>💾 保存当前画布到云端</button>
                            <div style={{fontSize:12, color:'#666', marginTop:10}}>我的云端存档:</div>
                            {projects.map(p => (
                                <div key={p.id} className="project-item">
                                    <span onClick={() => handleLoadProject(p.data)}>{p.name}</span>
                                    <span onClick={() => handleDeleteProject(p.id)} style={{color:'red', fontWeight:'bold'}}>×</span>
                                </div>
                            ))}
                            {projects.length === 0 && <div style={{fontSize:12, color:'#999', textAlign:'center'}}>暂无存档</div>}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

// -----------------------------------------------------------------------------
// 4. 主程序 (集成右侧面板开关)
// -----------------------------------------------------------------------------
function App() {
    const [session, setSession] = useState<any>(null)
    
    // 🟢 新增状态：控制右侧颜色面板是否展开
    const [isStyleOpen, setIsStyleOpen] = useState(true) 

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => { setSession(session) })
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session) })
        return () => subscription.unsubscribe()
    }, [])

    if (!session) return <LoginScreen onLoginSuccess={() => {}} /> 

	return (
		<div 
            style={{ position: 'fixed', inset: 0 }}
            // 🟢 关键：根据状态添加 className，CSS 会根据这个类名决定是否隐藏面板
            className={isStyleOpen ? '' : 'hide-right-panel'}
        >
            {/* 🟢 右侧面板的开关按钮 */}
            <button 
                className={`style-panel-toggle ${isStyleOpen ? 'active' : ''}`}
                onClick={() => setIsStyleOpen(!isStyleOpen)}
                title={isStyleOpen ? "收起颜色面板" : "展开颜色面板"}
            >
                {isStyleOpen ? '🎨' : '◀'}
            </button>

			{session?.user?.id ? (
                <Tldraw>
                    <CanvasDropZone />
                    <CustomSidebar currentUser={session.user} onLogout={() => supabase.auth.signOut()} />
                </Tldraw>
            ) : null}
		</div>
	)
}

export default App