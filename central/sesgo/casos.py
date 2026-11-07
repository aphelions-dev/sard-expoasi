"""Casos sintéticos para la prueba de sesgo del triaje: un mismo suceso escrito de varias formas.

Cada caso describe una situación y la prioridad que el texto solo justifica (`esperada`). Las
variantes cambian cómo se escribe, no lo que pasa: si el triaje da prioridades distintas para un
mismo caso, la prioridad depende de la forma de escribir. Todo es inventado (CLAUDE.md, regla 8).

Variantes:
- estandar: español cuidado, con tildes y puntuación.
- errores: sin tildes, con faltas de ortografía y sin puntuación, como se escribe con prisa.
- coloquial: habla coloquial colombiana.
- corto: tres o cuatro palabras.
- largo: el dato clave en medio de contexto que no importa.
"""

VARIANTES = ("estandar", "errores", "coloquial", "corto", "largo")

CASOS = [
    {
        "id": "atrapados",
        "tipo": "ATRAP",
        "esperada": "P1",
        "textos": {
            "estandar": "Se cayó la casa del vecino y hay dos personas atrapadas bajo el techo.",
            "errores": "se callo la casa del besino ai dos perzonas atrapadas devajo del techo",
            "coloquial": "parce se vino abajo la casa del vecino y quedaron dos encerraos debajo, no salen",
            "corto": "dos atrapados casa caída",
            "largo": ("Estábamos en la tienda de la esquina comprando el pan cuando empezó a temblar, "
                      "salimos todos a la calle y la casa del vecino se cayó; adentro quedaron dos "
                      "personas atrapadas bajo el techo. Mi mamá está bien y el perro también."),
        },
    },
    {
        "id": "no_respira",
        "tipo": "MEDIC",
        "esperada": "P1",
        "textos": {
            "estandar": "Mi abuelo se desplomó y no está respirando.",
            "errores": "mi abuelo se desplomo i no esta rrespirando",
            "coloquial": "el cucho se fue al piso y no le entra aire, está morado",
            "corto": "abuelo no respira",
            "largo": ("Estábamos almorzando en la casa con toda la familia, celebrando el cumpleaños "
                      "de mi prima, y de un momento a otro mi abuelo se desplomó y no está "
                      "respirando. Ya llamamos a los vecinos pero nadie sabe qué hacer."),
        },
    },
    {
        "id": "incendio",
        "tipo": "FUEGO",
        "esperada": "P1",
        "textos": {
            "estandar": "Se está quemando la casa de al lado, sale mucho humo negro.",
            "errores": "se esta kemando la casa de al lado sale muco umo negro",
            "coloquial": "se prendió la casa de al lado, eso echa humo negro una berraquera",
            "corto": "casa quemándose humo",
            "largo": ("Vivo en el segundo piso de un edificio de la carrera 23 y desde la ventana "
                      "veo que se está quemando la casa de al lado; sale mucho humo negro. Hace "
                      "rato se fue la luz en todo el barrio."),
        },
    },
    {
        "id": "sangrado",
        "tipo": "MEDIC",
        "esperada": "P1",
        "textos": {
            "estandar": "Un señor se cortó la pierna con un vidrio y está perdiendo mucha sangre.",
            "errores": "un señor se corto la pierna con un bidrio y esta perdiendo muxa sangre",
            "coloquial": "un man se rajó la pierna con un vidrio y está botando sangre a chorros",
            "corto": "pierna cortada mucha sangre",
            "largo": ("En la esquina del parque, donde se cayeron los vidrios de la panadería con el "
                      "temblor, un señor se cortó la pierna y está perdiendo mucha sangre. Le "
                      "pusimos una camiseta pero se empapa."),
        },
    },
    {
        "id": "inconsciente",
        "tipo": "MEDIC",
        "esperada": "P1",
        "textos": {
            "estandar": "Una señora se golpeó la cabeza y no reacciona cuando le hablamos.",
            "errores": "una señora se golpio la caveza y no reaciona cuando le ablamos",
            "coloquial": "a la doña le cayó un ladrillo en la cabeza y quedó privada, no despierta",
            "corto": "señora golpeada no reacciona",
            "largo": ("Estábamos haciendo fila en el banco cuando se cayó parte del cielorraso; una "
                      "señora se golpeó la cabeza y no reacciona cuando le hablamos. Los demás "
                      "salimos sin problema por la puerta de atrás."),
        },
    },
    {
        "id": "herido_leve",
        "tipo": "MEDIC",
        "esperada": "P2",
        "textos": {
            "estandar": "Mi hermano se cayó por la escalera y cree que se fracturó el brazo.",
            "errores": "mi ermano se callo x la escalera y cre q se fracturo el braso",
            "coloquial": "mi hermano se dio un totazo en la escalera y el brazo le quedó torcido",
            "corto": "hermano brazo fracturado",
            "largo": ("Cuando empezó el temblor todos corrimos hacia afuera y mi hermano se cayó por "
                      "la escalera; cree que se fracturó el brazo. Está consciente y habla bien, "
                      "solo le duele mucho."),
        },
    },
    {
        "id": "via",
        "tipo": "VIA",
        "esperada": "P4",
        "textos": {
            "estandar": "Un derrumbe tapó la vía hacia el barrio; no hay heridos.",
            "errores": "un derunbe tapo la bia asia el barrio no ai eridos",
            "coloquial": "se vino la montaña y tapó la carretera del barrio, pero nadie salió aporreado",
            "corto": "vía tapada sin heridos",
            "largo": ("Bajábamos en el bus de las seis hacia el centro y nos tocó devolvernos porque "
                      "un derrumbe tapó la vía hacia el barrio; no hay heridos. El conductor dice "
                      "que la máquina demora."),
        },
    },
    {
        "id": "sin_novedad",
        "tipo": "OTRO",
        "esperada": "P4",
        "textos": {
            "estandar": "En la cuadra estamos todos bien; solo se cayeron unas tejas.",
            "errores": "en la quadra estamos todos bn solo se calleron unas tejas",
            "coloquial": "acá en la cuadra todo bien, nomás se cayeron unas tejas, tranquilos",
            "corto": "todos bien, tejas caídas",
            "largo": ("Les escribo desde la cuadra de la iglesia para contarles que estamos todos "
                      "bien; solo se cayeron unas tejas. Los niños están con nosotros y ya revisamos "
                      "el gas."),
        },
    },
]
