'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Edit2, Check, Circle } from 'lucide-react'

type Todo = {
  id: string
  title: string
  completed: boolean
  created_at: string
}

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const supabase = createClient()

  const fetchTodos = async () => {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) console.error('Fetch Error:', error)
    else setTodos(data || [])
  }

  useEffect(() => {
    fetchTodos()

    const channel = supabase
      .channel('todos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, fetchTodos)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Add Todo
  const addTodo = async () => {
    if (!title.trim()) return
    const newTitle = title.trim()
    setTitle('')

    const optimisticTodo: Todo = {
      id: `temp-${Date.now()}`,
      title: newTitle,
      completed: false,
      created_at: new Date().toISOString(),
    }

    setTodos(prev => [optimisticTodo, ...prev])

    const { error, data } = await supabase
      .from('todos')
      .insert({ title: newTitle })
      .select()

    if (error) {
      setTodos(prev => prev.filter(t => t.id !== optimisticTodo.id))
    } else {
      setTodos(prev => prev.map(t => t.id === optimisticTodo.id ? data[0] : t))
    }
  }

  // Toggle Complete
  const toggleTodo = async (id: string, completed: boolean) => {
    const newCompleted = !completed

    // Optimistic Update
    setTodos(prev => prev.map(todo => 
      todo.id === id ? { ...todo, completed: newCompleted } : todo
    ))

    const { error } = await supabase
      .from('todos')
      .update({ completed: newCompleted })
      .eq('id', id)

    if (error) {
      console.error(error)
      fetchTodos() // Revert on error
    }
  }

  // Update Title
  const updateTodo = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingId(null)
      setEditTitle('')
      return
    }

    const newTitle = editTitle.trim()

    // Optimistic Update
    setTodos(prev => prev.map(todo => 
      todo.id === id ? { ...todo, title: newTitle } : todo
    ))

    const { error } = await supabase
      .from('todos')
      .update({ title: newTitle })
      .eq('id', id)

    if (error) {
      console.error("Update Error:", error)
      alert("Failed to update todo")
      fetchTodos() // Revert on error
    }

    setEditingId(null)
    setEditTitle('')
  }

  // Delete Todo
  const deleteTodo = async (id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id))

    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id)

    if (error) {
      console.error(error)
      fetchTodos()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-3">My Tasks</h1>
          <p className="text-gray-600 text-lg">Stay organized • Get things done</p>
        </div>

        {/* Add Input */}
        <div className="bg-white rounded-3xl shadow-xl p-2 mb-10">
          <div className="flex gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done today?"
              className="flex-1 px-6 py-4 bg-transparent text-lg placeholder-gray-400 focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            />
            <button
              onClick={addTodo}
              className="bg-blue-600 hover:bg-blue-700 transition-all text-white px-10 rounded-2xl flex items-center gap-2 font-medium shadow-lg shadow-blue-500/30"
            >
              <Plus size={24} /> Add
            </button>
          </div>
        </div>

        {/* Todo List */}
        <div className="space-y-3">
          {todos.length === 0 && (
            <div className="bg-white rounded-3xl p-16 text-center">
              <Circle size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-xl text-gray-500">No tasks yet</p>
            </div>
          )}

          {todos.map((todo) => (
            <div
              key={todo.id}
              className="group bg-white rounded-3xl shadow hover:shadow-xl transition-all duration-300 p-6 flex items-center gap-5"
            >
              <button
                onClick={() => toggleTodo(todo.id, todo.completed)}
                className={`w-8 h-8 rounded-2xl border-2 flex items-center justify-center transition-all flex-shrink-0
                  ${todo.completed ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-gray-400'}`}
              >
                {todo.completed && <Check size={20} className="text-white" />}
              </button>

              <div className="flex-1">
                {editingId === todo.id ? (
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && updateTodo(todo.id)}
                    onBlur={() => updateTodo(todo.id)}
                    className="w-full px-4 py-2.5 border border-blue-400 rounded-2xl focus:outline-none text-lg"
                    autoFocus
                  />
                ) : (
                  <p className={`text-lg break-words ${todo.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {todo.title}
                  </p>
                )}
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={() => {
                    setEditingId(todo.id)
                    setEditTitle(todo.title)
                  }}
                  className="p-3 hover:bg-gray-100 rounded-2xl text-gray-600 hover:text-blue-600"
                >
                  <Edit2 size={20} />
                </button>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="p-3 hover:bg-red-50 rounded-2xl text-gray-600 hover:text-red-500"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {todos.length > 0 && (
          <p className="text-center text-gray-500 mt-8 text-sm">
            {todos.filter(t => t.completed).length} of {todos.length} completed
          </p>
        )}
      </div>
    </div>
  )
}