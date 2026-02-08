'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUsers, createUser, deleteUser, updateUser } from '@/lib/api';

export default function UsuariosPage() {
    const { user, isLoading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Users State
    const [users, setUsers] = useState<any[]>([]);
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'user' });

    useEffect(() => {
        if (user?.role === 'admin') {
            loadUsers();
        } else {
            setLoading(false);
        }
    }, [user]);

    async function loadUsers() {
        try {
            setLoading(true);
            const data = await fetchUsers();
            setUsers(data || []);
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message || 'Error cargando usuarios' });
        } finally {
            setLoading(false);
        }
    }

    // --- User Handlers ---
    function startEdit(u: any) {
        setEditingUser(u);
        setUserForm({
            name: u.name,
            email: u.email,
            password: '',
            role: u.role
        });
        setMessage(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function cancelEdit() {
        setEditingUser(null);
        setUserForm({ name: '', email: '', password: '', role: 'user' });
        setMessage(null);
    }

    async function handleUserSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMessage(null);

        try {
            if (editingUser) {
                const updateData: any = { name: userForm.name, email: userForm.email, role: userForm.role };
                if (userForm.password) updateData.password = userForm.password;

                await updateUser(editingUser.id, updateData);
                setMessage({ type: 'success', text: 'Usuario actualizado correctamente' });
                setEditingUser(null);
            } else {
                await createUser(userForm);
                setMessage({ type: 'success', text: 'Usuario creado correctamente' });
            }

            setUserForm({ name: '', email: '', password: '', role: 'user' });
            loadUsers();
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message || 'Error en la operación' });
        }
    }

    async function handleDeleteUser(id: string) {
        if (!confirm('¿Eliminar usuario? Esta acción no se puede deshacer.')) return;
        try {
            await deleteUser(id);
            setMessage({ type: 'success', text: 'Usuario eliminado' });
            loadUsers();
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message || 'Error eliminando usuario' });
        }
    }

    if (authLoading) {
        return <div className="p-8 text-center text-slate-500">Cargando permisos...</div>;
    }

    if (user?.role !== 'admin') {
        return (
            <div className="flex items-center justify-center h-64 flex-col text-slate-500">
                <h2 className="text-xl font-bold text-slate-700">Acceso Restringido</h2>
                <p>Solo los administradores pueden ver esta página.</p>
                <p className="text-sm mt-2 text-slate-400">Tu rol actual: {user?.role || 'Desconocido'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Gestión de Usuarios</h1>
                <p className="text-slate-600 mt-1">Administra los usuarios del sistema</p>
            </div>

            {message && (
                <div className={`p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            {/* User Form */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                    {editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
                </h2>

                {editingUser && (
                    <button
                        onClick={cancelEdit}
                        className="absolute top-6 right-6 text-sm text-slate-500 hover:text-slate-700 underline"
                    >
                        Cancelar Edición
                    </button>
                )}

                <form onSubmit={handleUserSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                        <input
                            type="text"
                            value={userForm.name}
                            onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                            placeholder="Ej: Juan Pérez"
                            className="w-full px-3 py-2 border border-slate-300 rounded-md"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={userForm.email}
                            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                            placeholder="usuario@ejemplo.com"
                            className="w-full px-3 py-2 border border-slate-300 rounded-md"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            {editingUser ? 'Nueva Contraseña (Opcional)' : 'Contraseña'}
                        </label>
                        <input
                            type="password"
                            value={userForm.password}
                            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                            placeholder={editingUser ? "Dejar en blanco para no cambiar" : "Mínimo 6 caracteres"}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md"
                            required={!editingUser}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                        <select
                            value={userForm.role}
                            onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md"
                        >
                            <option value="user">Usuario</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <button
                            type="submit"
                            className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors font-medium"
                        >
                            {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Users List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-900">Usuarios Registrados</h2>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-slate-500">Cargando...</div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">No hay usuarios registrados</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Rol</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {users.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{u.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{u.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {u.role === 'admin' ? 'Administrador' : 'Usuario'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                            <button
                                                onClick={() => startEdit(u)}
                                                className="text-primary hover:text-primary/80"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(u.id)}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
