fn main() {
    println!("cargo:rerun-if-changed=sql");
    tauri_build::build()
}
