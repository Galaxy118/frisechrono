/* ═══════════════════════════════════════════════════════════
   pages/Home.jsx — Page d'accueil
   ═══════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Clock, Globe, Users, Sparkles, ArrowRight, Eye, Heart, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import friseService from '../services/friseService';
import { timeAgo, truncate } from '../utils/format';

function FriseCard({ frise, onClick }) {
  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer"
    >
      {/* Thumbnail */}
      <div className="h-36 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center overflow-hidden">
        {frise.thumbnail ? (
          <img src={frise.thumbnail} alt={frise.title} className="w-full h-full object-cover" />
        ) : (
          <Clock size={32} className="text-blue-300" />
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm truncate group-hover:text-blue-600 transition">{frise.title}</h3>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span>{timeAgo(frise.updatedAt || frise.createdAt)}</span>
          <div className="flex items-center gap-2">
            {frise.events?.length > 0 && <span>{frise.events.length} évt.</span>}
            {frise.isPublic && <Globe size={11} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myFrises, setMyFrises] = useState([]);
  const [publicFrises, setPublicFrises] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const promises = [];
      if (user) promises.push(friseService.list());
      else promises.push(Promise.resolve({ frises: [] }));
      promises.push(friseService.gallery({ limit: 6, sort: 'recent' }));

      const [myRes, pubRes] = await Promise.all(promises);
      setMyFrises(myRes.frises || []);
      setPublicFrises(pubRes.frises || []);
    } catch {}
    setLoading(false);
  };

  const createNew = async () => {
    if (!user) {
      navigate('/editor');
      return;
    }
    try {
      const res = await friseService.create();
      navigate(`/editor/${res.frise?._id || res._id}`);
    } catch {
      navigate('/editor');
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 text-white">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            Créez de belles <br className="hidden md:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 to-orange-300">frises chronologiques</span>
          </h1>
          <p className="text-blue-100 max-w-lg mx-auto mb-8 text-lg">
            Éditeur visuel simple et puissant. Partagez vos frises et explorez celles de la communauté.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={createNew}
              className="px-6 py-3 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition flex items-center gap-2 shadow-lg"
            >
              <Plus size={18} /> Créer une frise
            </button>
            <Link
              to="/gallery"
              className="px-6 py-3 border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition flex items-center gap-2"
            >
              <Globe size={18} /> Explorer la galerie
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Sparkles, title: 'Éditeur intuitif', desc: 'Ajoutez événements, périodes et césures en quelques clics. Personnalisez couleurs, polices et formats.' },
            { icon: Globe, title: 'Galerie publique', desc: 'Publiez vos frises et découvrez celles créées par la communauté. Filtrez par thème et période.' },
            { icon: Users, title: 'Partage facile', desc: 'Partagez vos frises via un lien privé ou rendez-les publiques. Exportez en haute résolution.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 bg-white rounded-xl border hover:shadow-md transition">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
                <Icon size={20} className="text-blue-600" />
              </div>
              <h3 className="font-bold mb-1">{title}</h3>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Mes frises */}
      {user && (
        <section className="max-w-6xl mx-auto px-6 pb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Mes frises</h2>
            <button onClick={createNew} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
              <Plus size={14} /> Nouvelle
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : myFrises.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed">
              <Clock size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-3">Vous n'avez pas encore de frise</p>
              <button onClick={createNew} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
                Créer ma première frise
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {myFrises.map((f, idx) => (
                <FriseCard key={f._id || f.id || idx} frise={f} onClick={() => navigate(`/editor/${f._id || f.id}`)} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Frises publiques récentes */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Frises récentes de la communauté</h2>
          <Link to="/gallery" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            Voir tout <ArrowRight size={14} />
          </Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : publicFrises.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Aucune frise publique pour le moment</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicFrises.map((f, idx) => (
              <div
                key={f._id || f.id || idx}
                onClick={() => navigate(`/gallery`)}
                className="group bg-white rounded-xl border overflow-hidden hover:shadow-lg transition cursor-pointer"
              >
                <div className="h-32 bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
                  {f.thumbnail ? (
                    <img src={f.thumbnail} alt={f.title} className="w-full h-full object-cover" />
                  ) : (
                    <Globe size={28} className="text-emerald-300" />
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm truncate">{f.title}</h3>
                  <div className="flex items-center justify-between mt-1.5 text-xs text-gray-400">
                    <span>par {f.author?.username || 'Anonyme'}</span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5"><Eye size={11} /> {f.views || 0}</span>
                      <span className="flex items-center gap-0.5"><Heart size={11} /> {f.likes?.length || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
